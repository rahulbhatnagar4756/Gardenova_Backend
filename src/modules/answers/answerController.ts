import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HTTP_STATUS } from "../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../core/utils/responseFormatter";
import {
  getRecommendedPartners,
  getRecommendedPlants,
} from "./answerRepository";
import { translateObject } from "./answerUtility";
import { ISurveyAnswer, IUserAnswer } from "../../interface/answer";
import { detectLanguage } from "../../core/middleware/translationMiddleware";
import { getDB } from "../../core/config/db";
import { createSurveyResponse } from "./answerModel";
import { getSignedFileUrl } from "../../core/services/s3UploadService";

/**
 * Handles submission of answers for multiple questions.
 * Validates the authenticated user, and saves the answers to the database.
 *
 * Each answer can be:
 *   - type = "1" → selectedOption
 *   - type = "2" → selectedAddress (state & city)
 *
 * @param req - Express request object containing answer data in the body
 * @param res - Express response object for sending the API response
 * @param next - Express next middleware function for error handling
 * @returns Promise<void>
 */
export const submitAnswer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let { answers } = req.body;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ message: "No answers provided" });
      return;
    }

    // insert raw data first (no translation yet)
    const { responseId } = await createSurveyResponse(answers);

    // respond to user
    res
      .status(HTTP_STATUS.CREATED)
      .json(successResponse({ responseId }, "Answers submitted successfully"));

    // Process translation and updates in background asynchronously
    setImmediate(() => {
      processAnswerTranslationAsync(responseId, answers).catch((err) => {
        console.error("Background translation failed:", {
          responseId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Validation failed", { issues: err.issues }));
      return;
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse("Something went wrong", {
        details: (err as Error).message,
      })
    );
    next(err);
  }
};

/**
 * Translates and processes survey answers asynchronously in the background.
 *
 * This function handles post-submission tasks such as translating survey answers
 * to a required format or language and performing any follow-up operations needed
 * for a given survey response.
 *
 * @param {string} responseId - The unique identifier of the submitted survey response.
 * @param {ISurveyAnswer[]} answers - The list of answers provided by the user.
 * @returns {Promise<void>} Resolves when all background translation operations are complete.
 */
async function processAnswerTranslationAsync(
  responseId: string,
  answers: ISurveyAnswer[]
): Promise<void> {
  try {
    // Detect language
    const firstText =
      answers.find((a) => typeof a.selectedOption === "string")
        ?.selectedOption ||
      answers.find((a) => a.selectedAddress?.city)?.selectedAddress?.city ||
      "";

    const detectedLang = firstText ? await detectLanguage(firstText) : null;

    // If Portuguese, translate and update
    if (detectedLang?.startsWith("pt")) {
      const translatedAnswers = await translateObject<ISurveyAnswer[]>(
        answers,
        "en"
      );
      await updateSurveyAnswersTranslation(responseId, translatedAnswers);
    }
  } catch (err) {
    throw err; // Caught by caller
  }
}

/**
 * Updates the translated survey answers in the database.
 *
 * This function saves the translated answers for a given survey response
 * by updating the corresponding records in the database.
 *
 * @param {string} responseId - The unique identifier of the survey response to update.
 * @param {ISurveyAnswer[]} translatedAnswers - The array of translated answers to be stored.
 * @returns {Promise<void>} Resolves when all answers have been successfully updated.
 */
async function updateSurveyAnswersTranslation(
  responseId: string,
  translatedAnswers: ISurveyAnswer[]
): Promise<void> {
  const pool = getDB();

  // Batch update using CASE statement
  const updateQuery = `
    UPDATE survey_answers
    SET selected_option = CASE question_id
      ${translatedAnswers.map((_, idx) => `WHEN $${idx * 2 + 2} THEN $${idx * 2 + 3}`).join(" ")}
    END
    WHERE response_id = $1
      AND question_id IN (${translatedAnswers.map((_, idx) => `$${idx * 2 + 2}`).join(", ")});
  `;

  const values = [
    responseId,
    ...translatedAnswers.flatMap((ans) => [
      ans.questionId,
      ans.selectedOption ??
        `${ans.selectedAddress?.state} / ${ans.selectedAddress?.city}`,
    ]),
  ];

  await pool.query(updateQuery, values);
}

/**
 * Get recommended plants based on survey answers associated with a response ID.
 *
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function for error handling
 */
// export const getRecommendedPlantsController = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { responseId } = req.params;

//     if (!responseId) {
//       res.status(400).json({ message: "responseId is required" });
//       return;
//     }

//     const client = await getDB();

//     // Fetch all answers for this response
//     const result = await client.query(
//       `SELECT question_id, answer_type, selected_option
//        FROM survey_answers
//        WHERE response_id = $1`,
//       [responseId]
//     );

//     if (result.rows.length === 0) {
//       res.status(404).json({ message: "No answers found for this responseId" });
//       return;
//     }

//     const answers = result.rows.map((row) => ({
//       questionId: row.question_id,
//       type: row.answer_type,
//       selectedOption: row.selected_option,
//     }));

//     // Get plant recommendations
//     const recommendedPlants = await getRecommendedPlants(answers);

//     const plantRecommendations = await Promise.all(
//       recommendedPlants.map(async (p) => ({
//         id: p.id,
//         name: p.common_name,
//         scientific: p.scientific_name,
//         image: (await getSignedFileUrl(p.image_search_url!)) || null,
//         description: p.description,
//         whyRecommended: p.whyRecommended,
//       }))
//     );

//     res.status(200).json(
//       successResponse(
//         {
//           plantRecommendations,
//         },
//         "Plant recommendations fetched successfully"
//       )
//     );
//   } catch (err) {
//     res.status(500).json(
//       errorResponse("Failed to fetch plant recommendations", {
//         details: (err as Error).message,
//       })
//     );
//     next(err);
//   }
// };

/**
 * Get recommended professional partners based on survey answers linked to a specific response ID.
 *
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function for error handling
 */
export const getRecommendedPartnersController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { responseId } = req.params;

    if (!responseId) {
      res.status(400).json({ message: "responseId is required" });
      return;
    }

    const client = await getDB();

    // Fetch all answers for this response
    const result = await client.query(
      `SELECT question_id, answer_type, selected_option
       FROM survey_answers
       WHERE response_id = $1`,
      [responseId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "No answers found for this responseId" });
      return;
    }

    const answers = result.rows.map((row) => ({
      questionId: row.question_id,
      type: row.answer_type,
      selectedOption: row.selected_option,
    }));

    // Determine if "aesthetic" answer was given (3rd question)
    const thirdAnswer = answers[2]?.selectedOption?.toLowerCase() || "";
    const showPartnerRecommendations = thirdAnswer.includes("aesthetic");

    if (!showPartnerRecommendations) {
      res.status(200).json(
        successResponse(
          {
            responseId,
            partnerRecommendations: [],
          },
          "No partner recommendations applicable for this response"
        )
      );
      return;
    }

    // Get partner recommendations
    const recommendedPartners = await getRecommendedPartners(answers);

    const partnerRecommendations = await Promise.all(
      recommendedPartners.map(async (partner) => ({
        partnerId: partner.partnerId,
        email: partner.email,
        mobileNumber: partner.mobileNumber,
        companyName: partner.companyName,
        speciality: partner.speciality,
        address: partner.address,
        website: partner.website,
        contactPerson: partner.contactPerson,
        projectImageUrl:
          (await getSignedFileUrl(partner.projectImageUrl!)) || null,
        rating: partner.rating,
        whyRecommended: partner.whyRecommended,
      }))
    );

    res
      .status(200)
      .json(
        successResponse(
          { partnerRecommendations },
          "Partner recommendations fetched successfully"
        )
      );
  } catch (err) {
    res.status(500).json(
      errorResponse("Failed to fetch partner recommendations", {
        details: (err as Error).message,
      })
    );
    next(err);
  }
};



/**
 * Controller to fetch recommended plants based on a user's survey response.
 *
 * @route GET /recommended-plants/:responseId
 *
 * @param {Request} req - Express request object containing route params.
 * @param {Response} res - Express response object used to return API response.
 * @param {NextFunction} next - Express next middleware function for error handling.
 *
 * @returns {Promise<void>} Sends a JSON response with recommended plants or an error.
 *
 * @description
 * This controller:
 * 1. Validates the presence of `responseId` in request params.
 * 2. Fetches survey answers from the database for the given response.
 * 3. Parses answers into the `IUserAnswer` format.
 *    - Handles "location" type answers which may be:
 *      - JSON string (e.g., {"state":"X","city":"Y"})
 *      - Plain string (treated as state)
 * 4. Calls the recommendation service to get plant suggestions.
 * 5. Transforms plant data into a simplified response format.
 * 6. Returns the result using a standardized success response.
 *
 * @throws {400} If responseId is missing
 * @throws {404} If no survey answers are found
 * @throws {500} If any internal error occurs
 */
// enum FieldIndex {
//   space_types      = 0,
//   area_sizes       = 1,
//   challenges       = 2,
//   tech_preferences = 3,
//   locations        = 4,
// }
/**
 * Controller to fetch recommended plants based on a user's survey responses.
 *
 * @async
 * @function getRecommendedPlantsController
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 *
 * @description
 * This controller:
 * 1. Extracts `responseId` from request params.
 * 2. Fetches survey answers from the database.
 * 3. Maps answers into a structured array based on question order.
 * 4. Parses location (state/city) from question 5 if applicable.
 * 5. Calls `getRecommendedPlants` service to compute recommendations.
 * 6. Formats and returns plant recommendation data.
 *
 * @throws {400} If `responseId` is missing
 * @throws {404} If no survey answers are found
 * @throws {500} If any internal error occurs
 *
 * @returns {Promise<void>} Sends JSON response with plant recommendations
 *
 * @example
 * // Route usage
 * router.get('/plants/recommendations/:responseId', getRecommendedPlantsController);
 *
 * @response 200
 * {
 *   success: true,
 *   message: "Plant recommendations fetched successfully",
 *   data: {
 *     plantRecommendations: [
 *       {
 *         id: number,
 *         name: string,
 *         scientific: string,
 *         image: string | null,
 *         category: string | null,
 *         careLevel: string | null,
 *         watering: string | null,
 *         sunlight: string | null,
 *         growthRate: string | null,
 *         indoor: boolean | null,
 *         droughtTolerant: boolean | null,
 *         climate: string | null,
 *         brazilRegion: string | null,
 *         color: string | null,
 *         edible: boolean | null,
 *         medicinal: boolean | null,
 *         descriptionPt: string | null,
 *         whyRecommended: string,
 *         matchScore: number
 *       }
 *     ]
 *   }
 * }
 */ 
export const getRecommendedPlantsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { responseId } = req.params;
 
    if (!responseId) {
      res.status(400).json({ message: "responseId is required" });
      return;
    }
 
    const client = await getDB();
 
    const result = await client.query(
      `SELECT
         sa.question_id,
         sa.answer_type,
         sa.selected_option,
         q.order AS question_order
       FROM survey_answers sa
       JOIN questions q ON q.id = sa.question_id
       WHERE sa.response_id = $1
         AND q.is_deleted = false
       ORDER BY q.order ASC`,
      [responseId]
    );
 
    if (result.rows.length === 0) {
      res.status(404).json({ message: "No answers found for this responseId" });
      return;
    }
 
    // Build answers array (0-indexed by question order)
    const answers: IUserAnswer[] = new Array(5).fill(null);
 
    for (const row of result.rows) {
      const fieldIndex = row.question_order - 1;
      if (fieldIndex < 0 || fieldIndex > 4) continue;
 
      let selectedAddress: { state?: string; city?: string } | undefined;
 
      if (row.question_order === 5 && row.selected_option) {
        try {
          const parsed = JSON.parse(row.selected_option);
          if (parsed && typeof parsed === "object") {
            selectedAddress = {
              state: parsed.state ?? parsed.State ?? undefined,
              city:  parsed.city  ?? parsed.City  ?? undefined,
            };
          }
        } catch {
          selectedAddress = { state: row.selected_option };
        }
      }
 
      answers[fieldIndex] = {
        questionId:      row.question_id,
        type:            row.answer_type,
        selectedOption:  row.selected_option,
        selectedAddress,
      };
    }
 
    const recommendedPlants = await getRecommendedPlants(answers);
 
    const plantRecommendations = recommendedPlants.map((p) => ({
      id:              p.id,
      name:            p.common_name_pt ?? p.common_name ?? p.scientific_name,
      scientific:      p.scientific_name,
      image:           p.image_url ?? null,
      category:        p.category ?? null,
      careLevel:       p.care_level ?? null,
      watering:        p.watering_pt ?? p.watering ?? null,
      sunlight:        p.sunlight ?? null,
      growthRate:      p.growth_rate ?? null,
      indoor:          p.indoor ?? null,
      droughtTolerant: p.drought_tolerant ?? null,
      climate:         p.climate ?? null,
      brazilRegion:    p.brazil_region ?? null,
      color:           p.color ?? null,
      edible:          p.edible ?? null,
      medicinal:       p.medicinal ?? null,
      descriptionPt:   p.description_pt ?? null,
      whyRecommended:  p.whyRecommended,
      matchScore:      p.matchScore,
    }));
 
    res.status(200).json(
      successResponse(
        { plantRecommendations },
        "Plant recommendations fetched successfully"
      )
    );
  } catch (err) {
    res.status(500).json(
      errorResponse("Failed to fetch plant recommendations", {
        details: (err as Error).message,
      })
    );
    next(err);
  }
};
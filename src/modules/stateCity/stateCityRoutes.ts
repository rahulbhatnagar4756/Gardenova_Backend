import express, { Router } from "express";
import {
  getStatesByCountry,
  getCountries,
  getCitiesByState,
} from "./stateCityController";
import { statesValidation } from "./stateCityValidations";

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: States
 *   description: States and countries management routes
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     State:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 4008
 *           description: Unique identifier for the state/province
 *         name:
 *           type: string
 *           example: Maharashtra
 *           description: Official name of the state/province
 *         iso2:
 *           type: string
 *           example: MH
 *           description: ISO2 code for the state/province
 *     Country:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 101
 *           description: Unique identifier for the country
 *         name:
 *           type: string
 *           example: India
 *           description: Official name of the country
 *         iso2:
 *           type: string
 *           example: IN
 *           description: ISO2 code for the country
 *         iso3:
 *           type: string
 *           example: IND
 *           description: ISO3 code for the country
 *     StatesResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Success
 *         data:
 *           type: object
 *           properties:
 *             country:
 *               type: string
 *               example: IN
 *             states:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/State'
 *             count:
 *               type: integer
 *               example: 36
 *     CountriesResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Success
 *         data:
 *           type: object
 *           properties:
 *             countries:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Country'
 *             count:
 *               type: integer
 *               example: 250
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Error message
 *         error:
 *           type: string
 *           example: Detailed error description
 */

/**
 * @swagger
 * /api/v1/stateCityData/countries:
 *   get:
 *     summary: Get all countries
 *     description: Retrieve all available countries from the Country State City API
 *     tags: [States]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of countries retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountriesResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/countries", statesValidation.getCountries, getCountries);

/**
 * @swagger
 * /api/v1/stateCityData/countries/states:
 *   get:
 *     summary: Get all states of Brazil
 *     description: Retrieve all states, provinces, regions, and territories for Brazil. The ISO2 code is fixed to "BR".
 *     tags: [States]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of Brazilian states retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatesResponse'
 *             examples:
 *               brazil_states:
 *                 summary: States of Brazil
 *                 value:
 *                   success: true
 *                   message: Success
 *                   data:
 *                     country: BR
 *                     states:
 *                       - name: Acre
 *                         iso2: AC
 *                       - name: Alagoas
 *                         iso2: AL
 *                       - name: Amapá
 *                         iso2: AP
 *                     count: 27
 *       401:
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/countries/states", getStatesByCountry);

/**
 * @swagger
 * components:
 *   schemas:
 *     City:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 131025
 *         name:
 *           type: string
 *           example: Mumbai
 *
 *     CitiesResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Success"
 *         data:
 *           type: object
 *           properties:
 *             country:
 *               type: string
 *               example: IN
 *             state:
 *               type: string
 *               example: MH
 *             cities:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/City'
 *             count:
 *               type: integer
 *               example: 645
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Error message describing the issue"
 */

/**
 * @swagger
 * /api/v1/stateCityData/countries/{iso2}/states/{stateIso2}/cities:
 *   get:
 *     summary: Get cities by country and state ISO2 codes
 *     description: Retrieve all cities for a specific state within a country using both country ISO2 and state ISO2 codes. Supports optional search filtering with autocomplete-style prefix matching.
 *     tags: [States]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: iso2
 *         required: true
 *         description: ISO2 code of the country (2 uppercase letters)
 *         schema:
 *           type: string
 *           pattern: '^[A-Z]{2}$'
 *           example: IN
 *       - in: path
 *         name: stateIso2
 *         required: true
 *         description: ISO2 code of the state/province (2-4 uppercase letters)
 *         schema:
 *           type: string
 *           pattern: '^[A-Z]{2,4}$'
 *           example: MH
 *       - in: query                        # 👈 new
 *         name: search
 *         required: false
 *         description: >
 *           Optional search term to filter cities by name using prefix matching (case-insensitive).
 *           Minimum 2 characters required for filtering to apply.
 *           Returns all cities when omitted.
 *         schema:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           example: Mum
 *     responses:
 *       200:
 *         description: List of cities retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CitiesResponse'
 *             examples:                    # 👈 new — shows both use cases in Swagger UI
 *               all_cities:
 *                 summary: All cities (no search param)
 *                 value:
 *                   success: true
 *                   data:
 *                     country: IN
 *                     state: MH
 *                     cities:
 *                       - id: 1
 *                         name: Mumbai
 *                       - id: 2
 *                         name: Pune
 *                     count: 2
 *               filtered_cities:
 *                 summary: Filtered cities (search=Mum)
 *                 value:
 *                   success: true
 *                   data:
 *                     country: IN
 *                     state: MH
 *                     query: mum
 *                     cities:
 *                       - id: 1
 *                         name: Mumbai
 *                     count: 1
 *       400:
 *         description: Bad request - Invalid ISO2 code format or search param exceeds maxLength
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: State not found or has no cities
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/countries/:iso2/states/:stateIso2/cities",
  statesValidation.getCitiesByState,
  getCitiesByState
);

export default router;

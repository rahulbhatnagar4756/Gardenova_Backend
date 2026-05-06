import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CompletedPart,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import config from "../config/env";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_A_K_ID,
    secretAccessKey: config.AWS_S_A_KEY,
  },
});

// 5MB chunk size for multipart upload
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Uploads a small file to AWS S3 using a simple upload.
 *
 * @param buffer - The file content as a Buffer.
 * @param fileName - The desired file name in the S3 bucket.
 * @param mimeType - The MIME type of the file.
 * @returns A promise that resolves to the public URL of the uploaded file.
 */
/**
 * Uploads a small file to AWS S3 using a simple upload and returns the file key.
 *
 * @param buffer - The file content as a Buffer.
 * @param fileName - The desired file name in the S3 bucket.
 * @param mimeType - The MIME type of the file.
 * @returns A promise that resolves to the S3 file key.
 */
const simpleUpload = async (
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: config.AWS_S3_BUCKET!,
    Key: fileName,
    Body: buffer,
    ContentType: mimeType,
    ServerSideEncryption: "AES256",
  });

  await s3Client.send(command);

  //Return only the S3 file key instead of the public URL
  return fileName;
};

/**
 * Uploads a base64-encoded image to AWS S3.
 * Uses a simple upload for small files and multipart upload with retry logic for larger files.
 *
 * @param base64Image - The base64 string representing the image, including MIME type prefix.
 * @param name - The name of the file to be saved in S3.
 * @param folder - The folder name inside the S3 bucket where the file will be stored.
 * @param maxRetries - The maximum number of retry attempts for multipart uploads. Defaults to 3.
 * @returns {Promise<string>} A promise that resolves to the public URL of the uploaded file.
 */
export const uploadBase64ToS3 = async (
  base64Image: string,
  name: string,
  folder: string,
  maxRetries = 3
): Promise<string> => {
  try {
    // Extract MIME type and base64 data
    const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
    if (!matches) throw new Error("Invalid base64 string");

    const mimeType = matches[1];
    const base64Data = matches[2];
    if (!mimeType || !base64Data) {
      throw new Error("Invalid base64 structure");
    }

    const buffer = Buffer.from(base64Data, "base64");
    const fileName = `${folder}/${name}`;

    // Use simple upload for small files
    if (buffer.length < CHUNK_SIZE) {
      return await simpleUpload(buffer, fileName, mimeType);
    }

    // Use multipart upload for large files
    return await multipartUploadWithRetry(
      buffer,
      fileName,
      mimeType,
      maxRetries
    );
  } catch (error: unknown) {
    const errObj: Error =
      error instanceof Error
        ? error
        : new Error(
            typeof error === "string" ? error : "Unknown S3 upload error"
          );

    throw new Error(`S3 Upload failed: ${errObj.message}`);
  }
};

/**
 * Performs a multipart upload to S3 with retry logic for each part.
 *
 * @param buffer - The file data as a Buffer.
 * @param fileName - The destination file name in the S3 bucket.
 * @param mimeType - The MIME type of the file being uploaded.
 * @param maxRetries - The maximum number of retry attempts for each part upload.
 * @returns {Promise<string>} A promise that resolves to the public URL of the uploaded file once the multipart upload is complete.
 */
const multipartUploadWithRetry = async (
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  maxRetries: number
): Promise<string> => {
  let uploadId: string | undefined;

  try {
    // Create multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: config.AWS_S3_BUCKET!,
      Key: fileName,
      ContentType: mimeType,
      ServerSideEncryption: "AES256",
    });

    const createResponse = await s3Client.send(createCommand);
    uploadId = createResponse.UploadId;
    if (!uploadId) {
      throw new Error("Failed to create multipart upload");
    }

    const totalParts = Math.ceil(buffer.length / CHUNK_SIZE);
    const parts: CompletedPart[] = [];

    // Upload each part with retry logic
    for (let i = 0; i < totalParts; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, buffer.length);
      const partBuffer = buffer.slice(start, end);

      let partResult: CompletedPart | null = null;
      let attempts = 0;

      while (attempts < maxRetries && !partResult) {
        try {
          const uploadPartCommand = new UploadPartCommand({
            Bucket: config.AWS_S3_BUCKET!,
            Key: fileName,
            PartNumber: i + 1,
            UploadId: uploadId,
            Body: partBuffer,
          });

          const uploadResult = await s3Client.send(uploadPartCommand);
          partResult = {
            ETag: uploadResult.ETag!,
            PartNumber: i + 1,
          };
        } catch (partError: unknown) {
          attempts++;

          const errObj: Error =
            partError instanceof Error
              ? partError
              : new Error(
                  typeof partError === "string"
                    ? partError
                    : `Unknown error uploading part ${i + 1}`
                );

          if (attempts >= maxRetries) {
            throw new Error(
              `Failed to upload part ${i + 1} after ${maxRetries} attempts: ${errObj.message}`
            );
          }

          // Exponential backoff before retry
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempts) * 1000)
          );
        }
      }

      parts.push(partResult!);
    }

    // Complete multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: config.AWS_S3_BUCKET!,
      Key: fileName,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0)),
      },
    });

    await s3Client.send(completeCommand);

    // ✅ Return only the S3 key (fileName)
    return fileName;
  } catch (error) {
    // Abort multipart upload on failure
    if (uploadId) {
      try {
        const abortCommand = new AbortMultipartUploadCommand({
          Bucket: config.AWS_S3_BUCKET!,
          Key: fileName,
          UploadId: uploadId,
        });
        await s3Client.send(abortCommand);
      } catch (abortError: unknown) {
        const errObj: Error =
          abortError instanceof Error
            ? abortError
            : new Error(
                typeof abortError === "string"
                  ? abortError
                  : "Unknown error during abort multipart upload"
              );
        console.error("Failed to abort multipart upload:", errObj.message);
      }
    }
    throw error;
  }
};

/**
 * Generates a pre-signed (temporary, secure) URL for accessing a private S3 object.
 *
 * @param fileKey - The key (path) of the file in the S3 bucket.
 * @returns A Promise that resolves to a signed URL allowing temporary access to the file.
 */
export const getSignedFileUrl = async (
  fileKey: string
): Promise<string | null> => {
  if (fileKey === null || fileKey === "") {
    return null;
  }
  const command = new GetObjectCommand({
    Bucket: config.AWS_S3_BUCKET!,
    Key: fileKey,
  });

  // expiresIn = seconds → 1 day = 86400 seconds
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 86400 });
  return signedUrl;
};

/**
 * Deletes a file from S3.
 * @param fileKey - The key (path) of the file to delete.
 */
export const deleteFileFromS3 = async (fileKey: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.AWS_S3_BUCKET!,
      Key: fileKey,
    });
    await s3Client.send(command);
  } catch (err) {
    console.error("Failed to delete file from S3:", err);
  }
};

/**
 * Uploads an image buffer to an S3 bucket and returns the stored file key.
 *
 * @param {Buffer} buffer - The image buffer to upload.
 * @param {string} fileName - The name of the file to store in S3.
 * @param {string} folder - The target S3 folder path.
 * @returns {Promise<string>} - The generated S3 object key.
 */
export async function uploadBufferToS3(
  buffer: Buffer,
  fileName: string,
  folder: string
): Promise<string> {
  const key = `${folder}/${fileName}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.AWS_S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: "image/jpeg",
      ServerSideEncryption: "AES256",
    })
  );

  return key;
}

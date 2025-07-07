import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import config from "./config.js";

const createS3Client = (accessKey, secretAccessKey, region) => {
  return new S3Client({
    region: region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretAccessKey,
    },
  });
};

const getS3ProductUrl = async (s3Client, filePath, bucket) => {
  const params = {
    Bucket: bucket,
    Key: filePath,
    Expires: config.URL_EXPIRY_MINUTES * 60,
  };
  const command = new GetObjectCommand(params);
  const digitalAssetUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600,
  });
  return digitalAssetUrl;
};

export { getS3ProductUrl, createS3Client };

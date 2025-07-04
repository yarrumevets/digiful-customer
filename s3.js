import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import awsConfig from "./aws.secret.js";
import config from "./config.js";

const s3 = new S3Client({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.s3AccessKey,
    secretAccessKey: awsConfig.s3SecretAccessKey,
  },
});

const getS3ProductUrl = async (filePath) => {
  const params = {
    Bucket: awsConfig.s3Bucket,
    Key: filePath,
    Expires: config.URL_EXPIRY_MINUTES * 60,
  };
  const command = new GetObjectCommand(params);
  const digitalAssetUrl = await getSignedUrl(s3, command, {
    expiresIn: 3600,
  });
  return digitalAssetUrl;
};

export { getS3ProductUrl };

// Send email via AWS SES
// Docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ses/command/SendEmailCommand/

import "dotenv/config";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Configure AWS SES credentials
const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION,
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  },
});

// Send the email.
const sendEmail = async (params) => {
  const formattedParams = {
    Source: `${params.fromName} <${params.fromEmail}>`,
    Destination: {
      ToAddresses: [params.toEmail],
    },
    Message: {
      Subject: { Data: params.subject, Charset: "UTF-8" },
      Body: {
        Text: { Data: params.bodyHtml, Charset: "UTF-8" },
        Html: { Data: params.bodyText, Charset: "UTF-8" },
      },
    },
  };

  console.log("=====> formatted params: ", formattedParams);

  const command = new SendEmailCommand(formattedParams);
  const data = await sesClient.send(command);
  return data.MessageId;
};

export { sendEmail };

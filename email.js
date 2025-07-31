// Send email via AWS SES
// Docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/ses/command/SendEmailCommand/

import "dotenv/config";
import config from "./config.js";
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
        Html: { Data: params.bodyHtml, Charset: "UTF-8" },
        Text: { Data: params.bodyText, Charset: "UTF-8" },
      },
    },
  };
  const command = new SendEmailCommand(formattedParams);
  const data = await sesClient.send(command);
  // @TODO - create log here, or return log object.
  return data.MessageId;
};

const emailTest = async (emailTestCode) => {
  let success;
  if (emailTestCode !== process.env.EMAIL_TEST_CODE) {
    return { success: false, error: "Unauthorized" };
  }
  const publicOrderId = "ABC123ABC123ABC123ABC123";
  const body = { customer: { email: process.env.TEST_TO_EMAIL } };
  const emailParams = composeEmailParams(body.customer.email, publicOrderId);
  const emailResult = await sendEmail(emailParams);
  return { success: true, emailResult };
};

const composeEmailParams = (toEmail, publicOrderId) => {
  return {
    fromName: config.emailFromName,
    fromEmail: config.emailFromAddress,
    toEmail: toEmail,
    subject: `Your digital product is ready from ${config.emailFromName}`,
    bodyHtml: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body {
              text-align: center;
            }
            h1 {
              font-size:24px;
              margin:0;
              padding:0;
            }
            p {
              font-size:16px;
            }
            img.banner {
              width:100%;
            }
          </style>
        </head>
        <body>
        <img class="banner" src="${config.emailBannerUrl}" />
          <h1>${config.emailTitle}</h1>
          <p><a href="${process.env.BASE_URL}/order/${publicOrderId}">Download your files here</a>.</p>
        </body>
      </html>
      `,
    bodyText: `${config.emailTitle}\n\nDownload here: ${process.env.BASE_URL}/order/${publicOrderId}`,
  };
};

export { sendEmail, composeEmailParams, emailTest };

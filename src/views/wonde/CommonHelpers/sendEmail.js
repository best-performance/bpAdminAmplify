import AWS from 'aws-sdk'
import { updateAWSCredentials } from './updateAWSCredentials'

/**
 *
 * function to send an email using AWS SES service, the parameters are obvious
 */

export async function sendEmail(subjectText, bodyText, senderEmail, addresseeList, ccList) {
  updateAWSCredentials()
  // Create sendEmail params
  var params = {
    Destination: {
      CcAddresses: ccList,
      ToAddresses: addresseeList,
    },
    Message: {
      Body: {
        Text: {
          Charset: 'UTF-8',
          Data: bodyText,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subjectText,
      },
    },
    Source: senderEmail,
  }
  // Create the promise and SES service object
  try {
    let data = await new AWS.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise()
    console.log(data.MessageId)
  } catch (err) {
    console.error(err, err.stack)
  }
}

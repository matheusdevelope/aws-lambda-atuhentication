import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import  { createCipheriv, createHash, randomBytes } from 'crypto';

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME || '';
const secretKey = process.env.SECRET_KEY || ''; 
const expirationDays = process.env.EXPIRATION_DAYS || '30'; 
export async function lambdaHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const { id, name } = JSON.parse(event.body || '{}');

    // Store the data in DynamoDB
    const item = {
      id: uuidv4(),
      name,
      is_expired: false,
    };

    await dynamoDB
      .put({
        TableName: tableName,
        Item: item,
      })
      .promise();

    // Calculate the expiration date (current time + 7 days)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + Number(expirationDays));

    // Encrypt the expiration date
    const encryptedExpirationDate = encryptText(expirationDate.toISOString(), secretKey);

    // Prepare the response
    const response = {
      id,
      expiration_date: encryptedExpirationDate,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
}

function encryptText(text: string, key: string): string {
  const algorithm = "aes-256-cbc";
  const iv = randomBytes(16); // Generate a random IV
  const cipher = createCipheriv(algorithm, createHash("sha256").update(key).digest(), iv);
  
  let encryptedText = cipher.update(text, "utf8", "hex");
  encryptedText += cipher.final("hex");

  const encryptedData = `${iv.toString("hex")}:${encryptedText}`;
  return encryptedData;
}

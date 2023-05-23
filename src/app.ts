import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as AWS from 'aws-sdk';
 import * as crypto from 'crypto';

 const dynamoDB = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || '';
const SECRET_KEY = process.env.SECRET_KEY || ''; 
const IV_KEY = process.env.IV_KEY || ''; 
const EXPIRATION_DAYS = Number(process.env.EXPIRATION_DAYS || '30'); 

interface Data {
    id:string,
    name:string,
    token:string,
    expirationDate:string|null,
    status: STATUS,
    createdAt:string,
    lastConsult:string
}
enum STATUS{
    APPROVED = 'APPROVED',
    PENDING = 'PENDING',
    REJECTED = 'REJECTED'
}

export const lambdaHandler = async (event: APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> => {
  const params = event.queryStringParameters;
  const id = params?.id|| '';
  const name = params?.name||'';

  if (!id || !name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Parâmetros id e name são obrigatórios.' })
    };
  }
  
   try {
    
    const hasPermission = await checkPermission(id);

  const Ret :Data= {
    id,
    name,
    token:'',
    expirationDate:'',
    status: STATUS.PENDING,
    createdAt:new Date().toISOString(),
    lastConsult:new Date().toISOString()
}
  if (hasPermission) {
    const expirationDate = calculateExpirationDate(EXPIRATION_DAYS);
  const token = generateToken(id, SECRET_KEY, IV_KEY);
    
    Ret.status = STATUS.APPROVED
    Ret.token = token;
    Ret.expirationDate = expirationDate.toISOString();
    expirationDate
  } 
  await saveDataOnDB(Ret);
  return {
    statusCode: Ret.status != STATUS.APPROVED ? 400 : 200,
    body:JSON.stringify(Ret)};
 } catch (error) {
    console.log(error);
    return {
        statusCode: 500,
        
        body:JSON.stringify({EXPIRATION_DAYS, SECRET_KEY,  error})};
}
return {
    statusCode: 400,
    body: JSON.stringify({ message: 'Something Wrong' })
  };
};

const checkPermission = async (id: string): Promise<boolean> => {
  const params = {
    TableName: TABLE_NAME,
    Key: { id }
  };
  const { Item } = await dynamoDB.get(params).promise();
  return Item?.status == STATUS.APPROVED;
};

const saveDataOnDB = async (data:Data) => {
  const params = {
    TableName: TABLE_NAME,
    Item: data
  };
  await dynamoDB.put(params).promise();
};

const calculateExpirationDate = (EXPIRATION_DAYS:number): Date => {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + EXPIRATION_DAYS);
  return expirationDate;
};

function generateToken(valueToEncrypt:string , keyString:string , ivBase64:string ) {
    const key = crypto.createHash('sha256').update(keyString).digest().slice(0, 24); 
    const iv = crypto.createHash('sha256').update(ivBase64).digest().slice(0, 16); 
    const cipher = crypto.createCipheriv('aes-192-cbc', key, iv);
    let encryptedData = cipher.update(valueToEncrypt, 'utf8', 'base64');
    encryptedData += cipher.final('base64');
    return encryptedData
 }

// function dechiper(encryptedValue, keyString, ivBase64) {
//     const key = crypto.createHash('sha256').update(keyString).digest().slice(0, 24); 
//     const iv = crypto.createHash('sha256').update(ivBase64).digest().slice(0, 16); 
//     const decipher = crypto.createDecipheriv('aes-192-cbc', key, iv);
//     let decryptedData = decipher.update(encryptedValue, 'base64', 'utf8');
//     decryptedData += decipher.final('utf8');
//     return decryptedData
// }

const awsconfig = {
  // added BC to enable access to Appsync for more complex update queries
  aws_appsync_graphqlEndpoint: `${process.env.REACT_APP_APPSYNC_API}`,
  aws_appsync_region: `${process.env.REACT_APP_REGION}`,
  aws_appsync_authenticationType: 'AMAZON_COGNITO_USER_POOLS',
  Auth: {
    //identityPoolId: `${process.env.REACT_APP_IDENTITY_POOL_ID}`,
    region: `${process.env.REACT_APP_REGION}`,
    identityPoolRegion: `${process.env.REACT_APP_REGION}`,
    userPoolId: `${process.env.REACT_APP_USER_POOL_ID}`,
    userPoolWebClientId: `${process.env.REACT_APP_USER_POOL_CLIENT_ID}`,
    identityPoolId: `${process.env.REACT_APP_IDENTITY_POOL_ID}`,
  },
  Storage: {
    AWSS3: {
      bucket: `${process.env.REACT_APP_UPLOADS_BUCKET}`, //REQUIRED -  Amazon S3 bucket name
      region: `${process.env.REACT_APP_REGION}`, //OPTIONAL -  Amazon service region
      identityPoolId: `${process.env.REACT_APP_IDENTITY_POOL_ID}`,
    },
  },
}

export default awsconfig

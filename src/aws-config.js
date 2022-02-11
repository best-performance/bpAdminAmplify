const awsconfig = {
  Auth: {
    //identityPoolId: `${process.env.REACT_APP_IDENTITY_POOL_ID}`,
    region: `${process.env.REACT_APP_REGION}`,
    identityPoolRegion: `${process.env.REACT_APP_REGION}`,
    userPoolId: `${process.env.REACT_APP_USER_POOL_ID}`,
    userPoolWebClientId: `${process.env.REACT_APP_USER_POOL_CLIENT_ID}`,
    identityPoolId: `${process.env.REACT_APP_IDENTITY_POOL}`,
  },
  Storage: {
    AWSS3: {
      bucket: `${process.env.REACT_APP_UPLOADS_BUCKET}`, //REQUIRED -  Amazon S3 bucket name
      region: `${process.env.REACT_APP_REGION}`, //OPTIONAL -  Amazon service region
      identityPoolId: `${process.env.REACT_APP_IDENTITY_POOL}`,
    },
  },
}

export default awsconfig

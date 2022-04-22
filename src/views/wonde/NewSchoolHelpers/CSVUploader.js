import { Storage } from '@aws-amplify/storage'
import { updateAWSCredentials } from '../CommonHelpers/updateAWSCredentials'

// function to read the currrent folders
async function listCurrentfiles(loggedIn) {
  await updateAWSCredentials()
  Storage.configure({
    bucket: process.env.REACT_APP_UPLOADS_BUCKET,
    region: 'eu-west-2', // there is only one bucket and its in the UK
    identityPoolId: `${process.env.REACT_APP_IDENTITY_POOL_ID}`,
  })
  //let listOfFolders = await Storage.list(`${loggedIn.schoolName}/`, { level: 'protected' })
  let listOfFolders = await Storage.list(``)
  console.log(
    'list of folders',
    listOfFolders.filter((folder) => folder.key.split('/') && folder.key.split('/')[1]),
  )
}

export async function CSVUploader(loggedIn) {
  console.log('logged In', loggedIn)

  await listCurrentfiles(loggedIn)

  return

  // await updateAWSCredentials()
  // Storage.configure({
  //   bucket: process.env.REACT_APP_UPLOADS_BUCKET,
  //   region: 'eu-west-2', // there is only one bucket and its in the UK
  //   identityPoolId: `${process.env.REACT_APP_IDENTITY_POOL_ID}`,
  // })

  // const data = [
  //   ['name1', 'city1', 'some other info'],
  //   ['name2', 'city2', 'more info'],
  // ]

  // let csvContent = 'data:text/csv;charset=utf-8,' + data.map((e) => e.join(',')).join('\n')

  // Storage.put(BucketURL….., csvContent, {
  //   contentType: 'application/vnd.ms-excel',
  // })
}

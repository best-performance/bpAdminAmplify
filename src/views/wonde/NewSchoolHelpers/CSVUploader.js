import { Storage } from '@aws-amplify/storage'
import { updateAWSCredentials } from '../CommonHelpers/updateAWSCredentials'

// function to read the currrent folders
async function listCurrentfiles(schoolName) {
  await updateAWSCredentials()
  Storage.configure({
    bucket: process.env.REACT_APP_UPLOADS_BUCKET,
    region: 'eu-west-2', // there is only one bucket and its in the UK
    identityPoolId: `${process.env.REACT_APP_IDENTITY_POOL_ID}`,
  })
  let listOfFolders = await Storage.list(`${schoolName}/`, { level: 'protected' })
  console.log(
    'list of folders',
    listOfFolders.filter((folder) => folder.key.split('/') && folder.key.split('/')[1]),
  )
}

/**
 * This function creates a CSV file from the filteredStudentList
 * and saves it to a csv file on S3
 * To create a csv file, create a long string with '\n' delimiting the rows
 * and ',' delimiting the fields.
 * Make a header row for the titles then the data in subsequent rows,
 * and the spreadsheet reader will recognise this format.
 */
export async function CSVUploader(schoolName, filteredStudentClassrooms) {
  console.log('FilteredStudentClassrooms', filteredStudentClassrooms)
  await listCurrentfiles(schoolName)

  //Make the heading row
  const titleNamePart = `First Name,Last Name,Year Level,Gender,Date of Birth,Classroom,`
  const titleRowTeachers1 = `Teacher1 First Name, Teacher1 Last Name, Teacher1 Email,`
  const titleRowTeachers2 = `Teacher2 First Name, Teacher2 Last Name, Teacher2 Email,`
  const titleRowTeachers3 = `Teacher3 First Name, Teacher3 Last Name, Teacher3 Email,`
  const titleRowTeachers4 = `Teacher4 First Name, Teacher4 Last Name, Teacher4 Email,`
  const titleRowTeachers5 = `Teacher5 First Name, Teacher5 Last Name, Teacher5 Email,\n`
  const titleRow =
    titleNamePart +
    titleRowTeachers1 +
    titleRowTeachers2 +
    titleRowTeachers3 +
    titleRowTeachers4 +
    titleRowTeachers5

  // add a csv file row for every studentClassroom
  let csvOutput = titleRow
  filteredStudentClassrooms.forEach((row, index) => {
    const studentClassroomPart = `${row.firstName},${row.lastName},${row.yearCode},${row.gender},${row.dob},${row.classroomName},`
    const teacher1Part = `${row['teacher1 FirstName']},${row['teacher1 LastName']},${row['teacher1 email']},`
    const teacher2Part = `${row['teacher2 FirstName']},${row['teacher2 LastName']},${row['teacher2 email']},`
    const teacher3Part = `${row['teacher3 FirstName']},${row['teacher3 LastName']},${row['teacher3 email']},`
    const teacher4Part = `${row['teacher4 FirstName']},${row['teacher4 LastName']},${row['teacher4 email']},`
    const teacher5Part = `${row['teacher5 FirstName']},${row['teacher5 LastName']},${row['teacher5 email']},\n`
    const rowOutput =
      studentClassroomPart +
      teacher1Part +
      teacher2Part +
      teacher3Part +
      teacher4Part +
      teacher5Part
    csvOutput += rowOutput
  })
  //console.log('csvOutput', csvOutput)
  await Storage.put(`${schoolName}/csvFile.csv`, csvOutput, {
    level: 'protected',
    contentType: 'application/vnd.ms-excel',
  })
  await listCurrentfiles(schoolName)
  return
}

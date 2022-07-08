/**
 * This function checks Students, Teachers (Users), Student Users, and classrooms
 * and reports any records that do not have a WondeID
 */
import { GetAllSchoolsFromDynamoDB } from './GetAllSchoolsFromDynamoDB'
import { getUploadedSchoolData } from './getUploadedSchoolData'
// Utility to remove spaces and hyphens from string and convert to upper case
function compressString(str) {
  return str.replace(/'|\s/g, '').toUpperCase()
}
export async function checkWondeIDs(selectedSchool) {
  console.log('selected school', selectedSchool)

  /*******************************************
   * Step 1.
   * Retrieve all available schools from Wonde and
   *  and check if there is a matching school name in EdCompanion/Elastik
   ******************************************/
  let dynamoSchools = await GetAllSchoolsFromDynamoDB()

  let matchingDynamoDBSchool = dynamoSchools.find(
    (x) => compressString(x.schoolName) === compressString(selectedSchool.schoolName),
  )
  if (matchingDynamoDBSchool) {
    console.log('Selected School found', matchingDynamoDBSchool)
  } else {
    // Should not reach here...
    console.log('Exiting addWondeIDs()......')
    console.log('Selected school not found in DynamoDB', selectedSchool.schoolName)
    return
  }
  /*******************************************
   *  Step 2.
   *  Retrieve the DynamoDB Data for the selected school
   ******************************************/
  let { uploadedClassrooms, uploadedTeachers, uploadedStudents } = await getUploadedSchoolData(
    selectedSchool.id,
  )
  console.log('************************************************')
  console.log('Checking WondeIDs for school ', selectedSchool.schoolName)
  console.log('************************************************')
  /*******************************************
   *  Step 3.
   *  check all students,classrooms and teachers
   ******************************************/
  let noIDCount = 0

  console.log('Students with missing WondeID and MISID')
  uploadedStudents.forEach((student) => {
    if (!(student.student.wondeID && student.student.MISID)) {
      console.log(student.student.firstName, student.student.lastName, student.yearLevel.yearCode)
      noIDCount++
    }
  })
  console.log('Of ' + uploadedStudents.length + ' students ' + noIDCount + ' have no ids')
  console.log('-----------------------------------------------')
  console.log('Classrooms with missing WondeID and MISID')
  noIDCount = 0
  uploadedClassrooms.forEach((classroom) => {
    if (!(classroom.wondeID && classroom.MISID)) {
      console.log(classroom.className, classroom.classType)
      noIDCount++
    }
  })
  console.log('Of ' + uploadedClassrooms.length + ' classrooms ' + noIDCount + ' have no ids')
  console.log('-----------------------------------------------')
  console.log('Teachers with missing WondeID and MISID')
  noIDCount = 0
  uploadedTeachers.forEach((teacher) => {
    if (!(teacher.wondeID && teacher.MISID)) {
      console.log(teacher.firstName, teacher.lastName, teacher.email)
      noIDCount++
    }
  })
  console.log('Of ' + uploadedTeachers.length + ' teachers ' + noIDCount + ' have no ids')
  console.log('-----------------------------------------------')
}

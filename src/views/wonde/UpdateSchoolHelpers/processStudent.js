const dayjs = require('dayjs')

// TODO: Put all table names in a separate file
const STUDENTCLASSROOM_TABLE = 'ClassroomStudent-xuuhgbt2kzebrpxdv67rr5pmze-develop'
const STUDENTCLASSROOM_INDEX = 'byStudent'

async function processStudent(student, docClient, studentTable, studentWondeIndex) {
  // first find if the student already exists
  let DBStudent = await findStudent(student, docClient, studentTable, studentWondeIndex)

  if (DBStudent.Count > 0) {
    // then student exists in the DB
    console.log(`${student.forename} ${student.surname} is existing student`)
    if (studentDetailsChanged(student, DBStudent.Items[0])) {
      console.log('-Update of student record needed')
    } else {
      console.log('-No student details changed')
    }
    console.log('-read ClassroomStudent table and update as needed')
    let DSClassChanges = await findClassChanges(
      DBStudent.Items[0].id, // the students EdC ID
      docClient,
      student,
    )
  } else {
    // then student is not in the DB
    console.log(`${student.forename} ${student.surname} is a "NEW" student`)
    console.log('-add a record to Student table')
    console.log('-add a record to SchoolStudentTable')
    console.log('-add to ClassroomStudent for every classroom assignment')
    console.log('-add a Cognito record')
  }
} // end process student

/******************************
 * Local Helper functions
 ******************************/
// find changes in clasroom assignments
async function findClassChanges(DBStudentID, docClient, student) {
  const queryParams = {
    TableName: STUDENTCLASSROOM_TABLE,
    IndexName: STUDENTCLASSROOM_INDEX,
    KeyConditionExpression: '#studentID = :studentID',
    ExpressionAttributeNames: {
      '#studentID': 'studentID',
    },
    ExpressionAttributeValues: {
      ':studentID': DBStudentID,
    },
  }
  try {
    let response = await docClient.query(queryParams).promise()
    console.log(
      'DB class Assignments: ',
      response.Items.length,
      'Wonde class Assignments: ',
      student.classes.data.length,
    )
    return true
  } catch (err) {
    console.log('error', err)
    return
  }
} //  end findClassChanges()

// check if Wonde student already exists in the EdC Student table
async function findStudent(student, docClient, studentTable, studentWondeIndex) {
  const queryParams = {
    TableName: studentTable,
    IndexName: studentWondeIndex,
    KeyConditionExpression: '#wondeID = :wondeID',
    ExpressionAttributeNames: {
      '#wondeID': 'wondeID',
    },
    ExpressionAttributeValues: {
      ':wondeID': student.id,
    },
  }
  try {
    let response = await docClient.query(queryParams).promise()
    return response
  } catch (err) {
    console.log('error', err)
    return
  }
} // end findStudent()

// Check if any student details have been updated in Wonde
function studentDetailsChanged(wondeStudent, DBStudent) {
  if (
    (wondeStudent.forename + wondeStudent.surname).toUpperCase() !==
    (DBStudent.firstName + DBStudent.lastName).toUpperCase()
  ) {
    console.log('Student name changed')
    return true
  }
  if (getGender(wondeStudent.gender) !== getGender(DBStudent.gender)) {
    console.log('Student gender changed')
    return true
  }
  if (dayjs(wondeStudent.date_of_birth.date).diff(dayjs(DBStudent.birthDate, 'day')) > 0) {
    console.log('Student dob changed')
    return true
  }
  return false
} // end studentDetailsChanged()

// Convert possible gender representations to "Male"|"Female"
function getGender(genderName) {
  switch (genderName.toUpperCase()) {
    case 'MALE':
    case 'M':
    case 'BOY':
    case 'B':
      return 'Male'
    case 'FEMALE':
    case 'F':
    case 'GIRL':
    case 'G':
      return 'Female'
    default:
      return 'X'
  }
} // end getGender()

export default processStudent

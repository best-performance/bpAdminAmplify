const dayjs = require('dayjs')
const AWS = require('aws-sdk')
const { updateAWSCredentials } = require('../CommonHelpers/updateAWSCredentials')

// TODO: Put all table names in a separate file
const STUDENT_TABLE = process.env.REACT_APP_STUDENT_TABLE
const SCHOOL_STUDENT_TABLE = process.env.REACT_APP_SCHOOL_STUDENT_TABLE
const CLASSROOM_TABLE = process.env.REACT_APP_CLASSROOM_TABLE
const CLASSROOM_TEACHER_TABLE = process.env.REACT_APP_CLASSROOM_TEACHER_TABLE
const CLASSROOM_STUDENT_TABLE = process.env.REACT_APP_CLASSROOM_STUDENT_TABLE

const STUDENT_WONDE_INDEX = 'byWondeID'
const CLASSROOM_STUDENT_INDEX = 'byStudent'

async function processStudent(student) {
  // get ready for AWS service calls
  updateAWSCredentials() // uses the Cognito Identify pool role
  let docClient = new AWS.DynamoDB.DocumentClient()

  // first find if the student already exists in the Student table (dynamoDB)
  let DBStudent = await findStudent(student, docClient)

  if (DBStudent.Count > 0) {
    // then student exists in the DB
    //console.log(`${student.forename} ${student.surname} is existing student`)
    return findStudentDetailChanges(student, DBStudent.Items[0])
  } else {
    // then student is not in the DB
    console.log(`${student.forename} ${student.surname} is a new student`)
    return [
      {
        firstName: student.forename,
        lastName: student.surname,
        gender: getGender(student.gender),
        dob: dayjs(student.date_of_birth.date).format('YYYY-MM-DD'),
        change: '"NEW"',
        source: 'Wonde',
      },
    ]
  }
} // end process student

/******************************
 * Local Helper functions
 ******************************/
// find changes in clasroom assignments
async function findClassChanges(DBStudentID, docClient, student) {
  const queryParams = {
    TableName: CLASSROOM_STUDENT_TABLE,
    IndexName: CLASSROOM_STUDENT_INDEX,
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
async function findStudent(student, docClient) {
  const queryParams = {
    TableName: STUDENT_TABLE,
    IndexName: STUDENT_WONDE_INDEX,
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
function findStudentDetailChanges(wondeStudent, DBStudent) {
  let changes = false
  let changeReason = ''
  let returnArray = []
  if (
    (wondeStudent.forename + wondeStudent.surname).toUpperCase() !==
    (DBStudent.firstName + DBStudent.lastName).toUpperCase()
  ) {
    changes = true
    changeReason += 'Name '
  }
  if (getGender(wondeStudent.gender) !== getGender(DBStudent.gender)) {
    changes = true
    changeReason += 'Gender '
  }
  if (dayjs(wondeStudent.date_of_birth.date).diff(dayjs(DBStudent.birthDate, 'day')) > 0) {
    changes = true
    changeReason += 'DoB'
  }
  if (changes) {
    returnArray.push({
      firstName: wondeStudent.forename,
      lastName: wondeStudent.surname,
      gender: getGender(wondeStudent.gender),
      dob: dayjs(wondeStudent.date_of_birth.date).format('YYYY-MM-DD'),
      change: changeReason,
      source: 'Wonde',
    })
    returnArray.push({
      firstName: DBStudent.firstName,
      lastName: DBStudent.lastName,
      gender: getGender(DBStudent.gender),
      dob: dayjs(DBStudent.birthDate).format('YYYY-MM-DD'),
      change: changeReason,
      source: 'DynamoDB',
    })
  }
  return returnArray
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

const dayjs = require('dayjs')
const { API } = require('aws-amplify')
const { updateAWSCredentials } = require('../CommonHelpers/updateAWSCredentials')
const { getGender } = require('../CommonHelpers/getGender')

export default async function processStudent(student) {
  // get ready for AWS service calls
  await updateAWSCredentials() // uses the Cognito Identify pool role

  // read the student and classes using Appsync
  let DBStudent = await findStudentClassesInDynamo(student)
  let changedClasses = []
  let changedStudent = []
  if (DBStudent.length > 0) {
    // then student exists in the DB - is returned as an array of size 1
    changedClasses = findClassChanges(student, DBStudent[0])
    //console.log('changed Classes', changedClasses)
    changedStudent = findStudentDetailChanges(student, DBStudent[0])
    return { changedStudent, changedClasses }
  } else {
    // then student is not in the DB
    console.log(`${student.forename} ${student.surname} is a new student`, student)
    changedStudent = [
      {
        id: student.id,
        firstName: student.forename,
        lastName: student.surname,
        gender: getGender(student.gender),
        dob: dayjs(student.date_of_birth.date).format('YYYY-MM-DD'),
        change: '"NEW"',
        source: 'Wonde',
      },
    ]
    student.classes.data.forEach((item) => {
      changedClasses.push({
        className: item.name,
        classType: 'Classroom',
        updatedAt: item.updated_at.date,
        wondeID: item.id,
        change: 'New Student',
      })
    })
    return { changedStudent, changedClasses }
  }
} // end process student

/******************************
 * Local Helper functions
 ******************************/
// Query stduents details in Dynamo, returning all data
// needed to check for student and class changes
const getStudentByWondeID = /* GraphQL */ `
  query GetStudentByWondeID($wondeID: String) {
    getStudentByWondeID(wondeID: $wondeID) {
      items {
        wondeID
        birthDate
        firstName
        lastName
        gender
        updatedAt
        classrooms {
          items {
            classroom {
              wondeID
              updatedAt
              className
              classType
            }
          }
        }
      }
    }
  }
`
async function findStudentClassesInDynamo(student) {
  try {
    const response = await API.graphql({
      query: getStudentByWondeID,
      variables: { wondeID: student.id },
      authMode: 'AMAZON_COGNITO_USER_POOLS',
    })

    // check if the student is assigned to some classrooms
    if (response.data.getStudentByWondeID.items.length > 0) {
      const {
        data: {
          getStudentByWondeID: { items },
        },
      } = response
      //console.log('classrooms in Dynamo for student', student.id, items)
    } else {
      //console.log('Student is not in dynamo', student.id, student.surname)
      return []
    }
    return response.data.getStudentByWondeID.items
  } catch (err) {
    console.log(err)
    return []
  }
} // end findStudentPlusClasses()

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
      id: wondeStudent.id,
      firstName: wondeStudent.forename,
      lastName: wondeStudent.surname,
      gender: getGender(wondeStudent.gender),
      dob: dayjs(wondeStudent.date_of_birth.date).format('YYYY-MM-DD'),
      change: changeReason,
      source: 'Wonde',
    })
    returnArray.push({
      id: DBStudent.id,
      firstName: DBStudent.firstName,
      lastName: DBStudent.lastName,
      gender: getGender(DBStudent.gender),
      dob: dayjs(DBStudent.birthDate).format('YYYY-MM-DD'),
      change: changeReason,
      source: 'DynamoDB',
    })
  } else {
    // we get here if the student details are not changed
    // but the classrooms maybe
    returnArray.push({
      id: wondeStudent.id,
      firstName: wondeStudent.forename,
      lastName: wondeStudent.surname,
      gender: getGender(wondeStudent.gender),
      dob: dayjs(wondeStudent.date_of_birth.date).format('YYYY-MM-DD'),
      change: 'No Change',
      source: 'Both',
    })
  }
  return returnArray
}

// Check if any student classes details have been updated in Wonde
function findClassChanges(wondeStudent, DBStudent) {
  //console.log('wondeStudent', wondeStudent)
  //console.log('DBStudent', DBStudent)
  let returnArray = []

  // have to work with the union of 2 lists of classrooms
  let DBClassesMap = new Map()
  let wondeClassesMap = new Map()

  // compare the arrays and note
  // if a class in in Dynmao - but not in Wonde
  // if a class is in Wonde - but not in Dynamo
  // if in both
  //   check if class name has changed
  //   check if the teacher has changed
  DBStudent.classrooms.items.forEach((item) => {
    DBClassesMap.set(item.classroom.wondeID, item.classroom)
  })
  //console.log('DBClassesMap', DBClassesMap)
  wondeStudent.classes.data.forEach((item) => {
    wondeClassesMap.set(item.id, item)
  })
  //console.log('wondeClassesMap', wondeClassesMap)

  DBStudent.classrooms.items.forEach((item) => {
    // is the classroom in the Wonde List?
    let wondeClass = wondeClassesMap.get(item.classroom.wondeID)
    if (wondeClass) {
      //console.log('classroom in wonde and Dynamo', item, wondeClass)
      let returnItem = { ...item.classroom }
      returnItem.change = 'In both'
      returnArray.push(returnItem)
    } else {
      //console.log('classroom in Dynamo only', item)
      let returnItem = { ...item.classroom }
      returnItem.change = 'Dynamo Only'
      returnArray.push(returnItem)
    }
  })
  wondeStudent.classes.data.forEach((item) => {
    // is the classroom in the Wonde List?
    let DBClass = DBClassesMap.get(item.id)
    if (DBClass) {
      //console.log('already returned', item)
    } else {
      //console.log('classroom in Wonde only', item)
      let returnItem = {
        className: item.name,
        classType: 'Classroom',
        updatedAt: item.updated_at.date,
        wondeID: item.id,
        change: 'Wonde Only',
      }
      returnArray.push(returnItem)
    }
  })

  return returnArray
}

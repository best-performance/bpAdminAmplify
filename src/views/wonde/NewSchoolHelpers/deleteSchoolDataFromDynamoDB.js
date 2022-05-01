import AWS from 'aws-sdk'
import { updateAWSCredentials } from '../CommonHelpers/updateAWSCredentials.js'
import { deleteUser } from './cognitoFns'

// Tables to store school data (NB its repeated in NewSchool)
const SCHOOL_TABLE = process.env.REACT_APP_SCHOOL_TABLE
const STUDENT_TABLE = process.env.REACT_APP_STUDENT_TABLE
const USER_TABLE = process.env.REACT_APP_USER_TABLE
const SCHOOL_STUDENT_TABLE = process.env.REACT_APP_SCHOOL_STUDENT_TABLE
const CLASSROOM_TABLE = process.env.REACT_APP_CLASSROOM_TABLE
const CLASSROOM_TEACHER_TABLE = process.env.REACT_APP_CLASSROOM_TEACHER_TABLE
const CLASSROOM_STUDENT_TABLE = process.env.REACT_APP_CLASSROOM_STUDENT_TABLE
const CLASSROOM_YEARLEVEL_TABLE = process.env.REACT_APP_CLASSROOM_YEARLEVEL_TABLE
const CLASSROOM_LEARNINGAREA_TABLE = process.env.REACT_APP_CLASSROOM_LEARNINGAREA_TABLE
const USER_POOL_ID = process.env.REACT_APP_EDCOMPANION_USER_POOL_ID

// const STUDENT_DATA_TABLE = 'StudentData'

// This is a new function to delete all records from the dynamo tables ( except the lookups)
// Its intended to be used only during testing - it empties all tables and Cognito entries for students and teachers
// WondeID refers to the school wonde ID
export async function deleteSchoolDataFromDynamoDB(wondeID) {
  await updateAWSCredentials()
  const docClient = new AWS.DynamoDB.DocumentClient()

  // list of tables to delete and what indexes to use to delete them
  let tablesMap = new Map()
  tablesMap.set(SCHOOL_TABLE, { index: 'byWondeID', indexName: 'wondeID' })
  tablesMap.set(CLASSROOM_TABLE, { index: 'byTypeBySchoolYear', indexName: 'schoolID' })
  tablesMap.set(CLASSROOM_YEARLEVEL_TABLE, { index: 'bySchoolByYearLevel', indexName: 'schoolID' })
  tablesMap.set(CLASSROOM_LEARNINGAREA_TABLE, { index: 'byClassroom', indexName: 'classroomID' }) // new
  tablesMap.set(USER_TABLE, { index: 'bySchool', indexName: 'userSchoolID' })
  tablesMap.set(CLASSROOM_TEACHER_TABLE, { index: 'byClassroom', indexName: 'classroomID' })
  tablesMap.set(SCHOOL_STUDENT_TABLE, { index: 'bySchool', indexName: 'schoolID' })
  tablesMap.set(CLASSROOM_STUDENT_TABLE, { index: 'byClassroom', indexName: 'classroomID' })

  let schoolRecords = []
  let classroomRecords = []
  let classroomYearLevelRecords = []
  let classroomLearningAreaRecords = [] // new
  let teacherUserRecords = []
  let classroomTeacherRecords = []
  let schoolStudentsRecords = []
  let studentRecords = []
  let studentUsersRecords = []
  let classroomStudentRecords = []

  // fn to retrieve all records matching the indexValue
  async function getAll(tableName, index, indexName, indexValue) {
    if (!indexValue) return []

    const queryParams = {
      TableName: tableName,
      IndexName: index,
      KeyConditionExpression: `#indexName = :indexValue`,
      ExpressionAttributeNames: {
        '#indexName': indexName,
      },
      ExpressionAttributeValues: {
        ':indexValue': indexValue,
      },
    }

    let response = []
    let accumulated = []
    // let ExclusiveStartKey
    do {
      try {
        response = await docClient.query(queryParams).promise()
      } catch (err) {
        console.log(`error getting the data from the table ${tableName}`, err)
      }

      // ExclusiveStartKey = response.LastEvaluatedKey
      accumulated = [...accumulated, ...response.Items]
    } while (response.LastEvaluatedKey)
    return accumulated
  }

  // fn to delete the records in batchs
  async function deleteAll(records, tableName, partitionKeyName) {
    if (records.length === 0) return
    const BATCH_SIZE = 25
    // find no of batches of 25 and add 1 for the remainder
    let batchesCount = parseInt(records.length / BATCH_SIZE) + 1
    let lastBatchSize = records.length % BATCH_SIZE // which could be 0
    console.log(
      `${tableName} has ${records.length} records, ${batchesCount} batches, last batch ${lastBatchSize}`,
    )

    //process each batch
    let recNo = 0 // index into the records array
    for (let i = 0; i < batchesCount; i++) {
      let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
      if (batchSize === 0) break // must have been an even no of batches

      // prepare the batc
      let batchToDelete = []
      for (let n = 0; n < batchSize; n++) {
        batchToDelete.push({
          DeleteRequest: { Key: { [partitionKeyName]: records[recNo][partitionKeyName] } },
          // translates to {Key: {id: records[n].id}} assuming partition name is "id"
        })
        recNo++
      } // end of batch loop

      // construct batchWrite() params object
      let params = {
        RequestItems: {
          [tableName]: batchToDelete, //[] notation constructs key name from variable
        },
      }
      // cary out the batchDelete
      //console.log(`deleting batch ${i}`)
      try {
        await docClient.batchWrite(params).promise()
        //console.log(`batch ${i} deleted`)
      } catch (err) {
        console.log(`problem deleting batch ${i} in ${tableName}`, err)
      }
    } // end of aray loop
  } // end deleteAll()

  // Getting records for the school by wondeID
  let schoolTableData = tablesMap.get(SCHOOL_TABLE)
  schoolRecords = await getAll(
    SCHOOL_TABLE,
    schoolTableData.index,
    schoolTableData.indexName,
    wondeID,
  )
  console.log(`Step 1 - School record found (${schoolRecords.length}):`, schoolRecords)

  // Getting all classrooms for the school
  // Retrieve using the schoolID index of table Classroom
  let classroomTableData = tablesMap.get(CLASSROOM_TABLE)
  classroomRecords = await getAll(
    CLASSROOM_TABLE,
    classroomTableData.index,
    classroomTableData.indexName,
    schoolRecords && schoolRecords.length > 0 ? schoolRecords[0].id : null,
  )
  console.log(`Step 2 - Classrooms records found (${classroomRecords.length})`, classroomRecords)

  // Getting classroomYearLevel records - using the schoolID Index
  // This is is unusual in that the table has a scholID index
  // so we can read the all in one query
  // For all the other classroomX tables we have to scan the classroom table
  // to get the classroomIDs and do multiple queries.
  let classroomYearLevelTableData = tablesMap.get(CLASSROOM_YEARLEVEL_TABLE)
  classroomYearLevelRecords = await getAll(
    CLASSROOM_YEARLEVEL_TABLE,
    classroomYearLevelTableData.index,
    classroomYearLevelTableData.indexName,
    schoolRecords && schoolRecords.length > 0 ? schoolRecords[0].id : null,
  )
  console.log(
    `Step 3 - ClassroomYearLevel records found (${classroomYearLevelRecords.length}`,
    classroomYearLevelRecords,
  )

  // New
  // Getting the classroomLearningArea records
  // We have to do this classroom by classroom
  let classroomLearningAreaTableData = tablesMap.get(CLASSROOM_LEARNINGAREA_TABLE)
  if (classroomRecords && classroomRecords.length > 0) {
    // For every classroom:
    //    locate all the classroomLearningArea records by classroomID
    for (let i = 0; i < classroomRecords.length; i++) {
      let classroom = classroomRecords[i]
      let classroomLearningAreaData = await getAll(
        CLASSROOM_TEACHER_TABLE,
        classroomLearningAreaTableData.index,
        classroomLearningAreaTableData.indexName,
        classroom ? classroom.id : null,
      )
      classroomLearningAreaRecords = [...classroomLearningAreaRecords, ...classroomLearningAreaData]
    }
  }
  console.log(
    `Step 4 - classroomLearningArea records found ${classroomLearningAreaRecords.length}`,
    classroomLearningAreaRecords,
  )

  // Getting the teacher User records and the Student User records
  // Use the schoolID index of User table
  let userTableData = tablesMap.get(USER_TABLE)
  let schoolUsersData = await getAll(
    USER_TABLE,
    userTableData.index,
    userTableData.indexName,
    schoolRecords && schoolRecords.length > 0 ? schoolRecords[0].id : null,
  )
  // Separate out the teacher and student User records
  schoolUsersData.forEach((schoolUser) => {
    if (schoolUser.userType === 'Educator') {
      teacherUserRecords.push(schoolUser)
    } else if (schoolUser.userType === 'Student') {
      studentUsersRecords.push(schoolUser)
    } else {
      console.log('There is an unknown userType value in this record', schoolUser)
    }
  })
  console.log(
    `Step 5a - Teacher User records found ${teacherUserRecords.length}`,
    teacherUserRecords,
  )
  console.log(
    `Step 5b - Student User records found ${studentUsersRecords.length}`,
    studentUsersRecords,
  )

  // Getting the classroomTeacherRecords for every classroom
  let classroomTeacherTableData = tablesMap.get(CLASSROOM_TEACHER_TABLE)
  if (classroomRecords && classroomRecords.length > 0) {
    // For every classroom:
    //    locate all the classroomTeacher records using the classroomID index
    for (let i = 0; i < classroomRecords.length; i++) {
      let classroom = classroomRecords[i]
      let classroomTeacherData = await getAll(
        CLASSROOM_TEACHER_TABLE,
        classroomTeacherTableData.index,
        classroomTeacherTableData.indexName,
        classroom ? classroom.id : null,
      )
      classroomTeacherRecords = [...classroomTeacherRecords, ...classroomTeacherData]
    }
  }
  console.log(
    `Step 6 - ClassroomTeacher records found ${classroomTeacherRecords.length}`,
    classroomTeacherRecords,
  )

  // Getting the classroomStudent records for every classroom
  let classroomStudentTableData = tablesMap.get(CLASSROOM_STUDENT_TABLE)
  if (classroomRecords && classroomRecords.length > 0) {
    // For every classroom:
    //    locate all the classroomStudent records using the classroomID index
    for (let i = 0; i < classroomRecords.length; i++) {
      let classroom = classroomRecords[i]
      let classroomStudentData = await getAll(
        CLASSROOM_STUDENT_TABLE,
        classroomStudentTableData.index,
        classroomStudentTableData.indexName,
        classroom ? classroom.id : null,
      )
      classroomStudentRecords = [...classroomStudentRecords, ...classroomStudentData]
    }
  }
  console.log(
    `Step 7 - ClassroomStudent records found ${classroomStudentRecords.length}`,
    classroomStudentRecords,
  )

  // Getting the records for schoolStudents for the wondeSchoolID
  let schoolStudentRecordsTableData = tablesMap.get(SCHOOL_STUDENT_TABLE)
  schoolStudentsRecords = await getAll(
    SCHOOL_STUDENT_TABLE,
    schoolStudentRecordsTableData.index,
    schoolStudentRecordsTableData.indexName,
    schoolRecords && schoolRecords.length > 0 ? schoolRecords[0].id : null,
  )
  console.log(
    `Step 8 - SchoolStudent records found ${schoolStudentsRecords.length}`,
    schoolStudentsRecords,
  )

  // Getting the records for student table for the wondeSchoolID
  schoolStudentsRecords.forEach((schoolStudent) => {
    studentRecords.push({ id: schoolStudent.studentID })
  })
  console.log(`Step 9 - Student records found ${studentRecords.length}`, studentRecords)
  console.log(
    `Step 5b repeat - student User records found ${studentUsersRecords.length}`,
    studentUsersRecords,
  )

  // After retrieving each table's data, they should be deleted in the following order
  console.log('D1 - Deleting ClassroomYearLevel records)')
  await deleteAll(classroomYearLevelRecords, CLASSROOM_YEARLEVEL_TABLE, 'id')

  //New
  console.log('D2 - Deleting ClassroomLearningArea records')
  await deleteAll(classroomLearningAreaRecords, CLASSROOM_LEARNINGAREA_TABLE, 'id')

  console.log('D3 - Deleting ClassroomTeacher records')
  await deleteAll(classroomTeacherRecords, CLASSROOM_TEACHER_TABLE, 'id')

  console.log('D4 - Deleting classroomStudent records')
  await deleteAll(classroomStudentRecords, CLASSROOM_STUDENT_TABLE, 'id')

  console.log('D5 - Deleting Classroom records')
  await deleteAll(classroomRecords, CLASSROOM_TABLE, 'id')

  // Deleting cognito users for teachers
  console.log('D6a - Deleting Cognito users for teachers')
  for (let i = 0; i < teacherUserRecords.length; i++) {
    await deleteUser(teacherUserRecords[i].userId, USER_POOL_ID)
  }

  console.log('D6b - Deleting teacher User records')
  await deleteAll(teacherUserRecords, USER_TABLE, 'email')

  console.log('D7 - Deleting SchoolStudentsRecords records (D7)')
  await deleteAll(schoolStudentsRecords, SCHOOL_STUDENT_TABLE, 'id')

  console.log('D8a - Deleting Student records records')
  await deleteAll(studentRecords, STUDENT_TABLE, 'id')

  // Deleting cognito users for students
  // console.log('D8b - Deleting Cognito users for students')
  // for (let i = 0; i < studentUsersRecords.length; i++) {
  //   await deleteUser(studentUsersRecords[i].userId, USER_POOL_ID)
  // }

  console.log('D9 - Deleting student Users records')
  await deleteAll(studentUsersRecords, USER_TABLE, 'email')

  console.log('D10 - Deleting School records records')
  await deleteAll(schoolRecords, SCHOOL_TABLE, 'id')

  console.log('All data deleted for school')
} // end of function deleteSchoolDataFromDynamoDB()

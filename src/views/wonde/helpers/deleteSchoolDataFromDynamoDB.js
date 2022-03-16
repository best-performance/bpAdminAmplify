import AWS from 'aws-sdk'
import { updateAWSCredentials } from './updateAWSCredentials.js'
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
const USER_POOL_ID = process.env.REACT_APP_EDCOMPANION_USER_POOL_ID

// const STUDENT_DATA_TABLE = 'StudentData'

// This is a new function to delete all records from the dynamo tables ( except the lookups)
// Its intended to be used only during testing - it empties all tables
// WondeID refers to the school wonde ID
export async function deleteSchoolDataFromDynamoDB(wondeID) {
  await updateAWSCredentials()
  const docClient = new AWS.DynamoDB.DocumentClient()
  // list of table to delete
  // SHOULD REALLY CHECK IF THE TABLE EXISTS FIRST

  let tablesMap = new Map()
  tablesMap.set(SCHOOL_TABLE, { index: 'byWondeID', indexName: 'wondeID' })
  tablesMap.set(CLASSROOM_TABLE, { index: 'byTypeBySchoolYear', indexName: 'schoolID' })
  tablesMap.set(CLASSROOM_YEARLEVEL_TABLE, { index: 'bySchoolByYearLevel', indexName: 'schoolID' })
  tablesMap.set(USER_TABLE, { index: 'bySchool', indexName: 'userSchoolID' })
  tablesMap.set(CLASSROOM_TEACHER_TABLE, { index: 'byClassroom', indexName: 'classroomID' })
  tablesMap.set(SCHOOL_STUDENT_TABLE, { index: 'bySchool', indexName: 'schoolID' })
  tablesMap.set(CLASSROOM_STUDENT_TABLE, { index: 'byClassroom', indexName: 'classroomID' })

  // let tablesList = [
  //   { tableName: SCHOOL_TABLE, partitionKeyName: 'id', index: 'byWondeID', indexName: 'wondeID' },
  //   // { tableName: STUDENT_TABLE, partitionKeyName: 'id' },
  //   // { tableName: USER_TABLE, partitionKeyName: 'email' }, // note partition Key for User table
  //   // { tableName: SCHOOL_STUDENT_TABLE, partitionKeyName: 'id' },
  //   {
  //     tableName: CLASSROOM_TABLE,
  //     partitionKeyName: 'id',
  //     index: 'byTypeBySchoolYear',
  //     indexName: 'schoolID',
  //   },
  //   // { tableName: CLASSROOM_TEACHER_TABLE, partitionKeyName: 'id' },
  //   // { tableName: CLASSROOM_STUDENT_TABLE, partitionKeyName: 'id' },
  //   // { tableName: CLASSROOM_YEARLEVEL_TABLE, partitionKeyName: 'id' },
  //   // { tableName: CLASSROOM_LEARNING_AREA_TABLE, partitionKeyName: 'id' },
  //   //{ tableName: STUDENT_DATA_TABLE, partitionKeyName: 'id' },
  // ]
  // first lets delete one data from one table
  // scan the table
  let schoolRecords = []
  let classroomRecords = []
  let classroomYearLevelRecords = []
  let teacherUserRecords = []
  let classroomTeacherRecords = []
  let schoolStudentsRecords = []
  let studentRecords = []
  let studentUsersRecords = []
  let classroomStudentRecords = []

  // fn to query in the records
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
    // find no of batches of 25 and add 1 for teh remainder
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
        })
        recNo++
      } // end of batch loop

      // construct batchWrite() params obkect
      let params = {
        RequestItems: {
          [tableName]: batchToDelete, //[] notation constructs key name from variable
        },
      }
      // cary out the bacthDelete
      //console.log(`deleting batch ${i}`)
      try {
        await docClient.batchWrite(params).promise()
        //console.log(`batch ${i} deleted`)
      } catch (err) {
        console.log(`problem deleting batch ${i} in ${tableName}`, err)
      }
    } // end of aray loop
  }

  // Getting records for the school wonde ID
  let schoolTableData = tablesMap.get(SCHOOL_TABLE)
  schoolRecords = await getAll(
    SCHOOL_TABLE,
    schoolTableData.index,
    schoolTableData.indexName,
    wondeID,
  )
  console.log('this is the school record returned (1)', schoolRecords)

  // Getting classrooms for the school in process
  let classroomTableData = tablesMap.get(CLASSROOM_TABLE)
  classroomRecords = await getAll(
    CLASSROOM_TABLE,
    classroomTableData.index,
    classroomTableData.indexName,
    schoolRecords && schoolRecords.length > 0 ? schoolRecords[0].id : null,
  )
  console.log('these are the classrooms returned (2)', classroomRecords)

  let classroomYearLevelTableData = tablesMap.get(CLASSROOM_YEARLEVEL_TABLE)
  let classroomYearLevelData = await getAll(
    CLASSROOM_YEARLEVEL_TABLE,
    classroomYearLevelTableData.index,
    classroomYearLevelTableData.indexName,
    schoolRecords && schoolRecords.length > 0 ? schoolRecords[0].id : null,
  )
  classroomYearLevelRecords = [...classroomYearLevelRecords, ...classroomYearLevelData]

  console.log('These are the classroomYearLevelRecords found (3)', classroomYearLevelRecords)

  console.log('Getting the teacher users records for the schoolId')
  let userTableData = tablesMap.get(USER_TABLE)
  let schoolUsersData = await getAll(
    USER_TABLE,
    userTableData.index,
    userTableData.indexName,
    schoolRecords && schoolRecords.length > 0 ? schoolRecords[0].id : null,
  )

  schoolUsersData.forEach((schoolUser) => {
    if (schoolUser.userType === 'Educator') {
      teacherUserRecords.push(schoolUser)
    } else if (schoolUser.userType === 'Student') {
      studentUsersRecords.push(schoolUser)
    } else {
      console.log('There is an unknown userType value in this record', schoolUser)
    }
  })

  console.log('These are the teacher records (5)', teacherUserRecords)

  // Getting the classroomTeacherRecords for every teacher record
  let classroomTeacherTableData = tablesMap.get(CLASSROOM_TEACHER_TABLE)
  if (classroomRecords && classroomRecords.length > 0) {
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
  console.log('These are the classroomTeacher records (6)', classroomTeacherRecords)

  // Getting the records for the classroom students
  let classroomStudentTableData = tablesMap.get(CLASSROOM_STUDENT_TABLE)
  if (classroomRecords && classroomRecords.length > 0) {
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
  console.log('These are the classroom student records (9)', classroomStudentRecords)

  // Getting the records for schoolStudents for the wondeSchoolID
  let schoolStudentRecordsTableData = tablesMap.get(SCHOOL_STUDENT_TABLE)
  schoolStudentsRecords = await getAll(
    SCHOOL_STUDENT_TABLE,
    schoolStudentRecordsTableData.index,
    schoolStudentRecordsTableData.indexName,
    schoolRecords && schoolRecords.length > 0 ? schoolRecords[0].id : null,
  )
  console.log('these are the schoolStudent records returned (8)', schoolStudentsRecords)

  // Getting the records for student table for the wondeSchoolID
  schoolStudentsRecords.forEach((schoolStudent) => {
    studentRecords.push({ id: schoolStudent.studentID })
  })
  console.log('these are the student records returned (7)', studentRecords)

  console.log('these are the studentUser records returned (10)', studentUsersRecords)

  // After getting all the records for the tables, those ones should be deleted in the following order
  /**
   *
   */

  console.log('Deleting ClassroomYearLevel records (D1)')
  await deleteAll(classroomYearLevelRecords, CLASSROOM_YEARLEVEL_TABLE, 'id')

  // Pending to delete classroomLearningArea D2

  console.log('Deleting classroomTeacher records (D3)')
  await deleteAll(classroomTeacherRecords, CLASSROOM_TEACHER_TABLE, 'id')

  console.log('Deleting classroomStudent records (D4)')
  await deleteAll(classroomStudentRecords, CLASSROOM_STUDENT_TABLE, 'id')

  console.log('Deleting Classroom records (D5)')
  await deleteAll(classroomRecords, CLASSROOM_TABLE, 'id')

  // Deleting cognito users for teachers
  console.log('Deleting cognito users for teachers')
  for (let i = 0; i < teacherUserRecords.length; i++) {
    await deleteUser(teacherUserRecords[i].userId, USER_POOL_ID)
  }

  console.log('Deleting teacherUser records (D6)')
  await deleteAll(teacherUserRecords, USER_TABLE, 'email')

  console.log('Deleting schoolStudentsRecords records (D7)')
  await deleteAll(schoolStudentsRecords, SCHOOL_STUDENT_TABLE, 'id')

  console.log('Deleting studentRecords records (D8)')
  await deleteAll(studentRecords, STUDENT_TABLE, 'id')

  // console.log('Deleting cognito users for students')
  // for (let i = 0; i < studentUsersRecords.length; i++) {
  //   await deleteUser(studentUsersRecords[i].userId, USER_POOL_ID)
  // }

  console.log('Deleting studentUsers records (D9)')
  await deleteAll(studentUsersRecords, USER_TABLE, 'email')

  // Deleting cognito users for students

  console.log('Deleting SchoolRecords records (D10)')
  await deleteAll(schoolRecords, SCHOOL_TABLE, 'id')

  console.log('Delete data for the school is finished')
} // end of test function deleteSchoolDataFromDynamoDB()

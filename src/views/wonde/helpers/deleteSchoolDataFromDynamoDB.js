import AWS from 'aws-sdk'
// Tables to store school data (NB its repeated in NewSchool)
const SCHOOL_TABLE = 'Schools'
const STUDENT_TABLE = 'Student'
const USER_TABLE = 'User'
const SCHOOL_STUDENT_TABLE = 'SchoolStudent'
const CLASSROOM_TABLE = 'Classroom'
const CLASSROOM_TEACHER_TABLE = 'ClassroomTeacher'
const CLASSROOM_STUDENT_TABLE = 'ClassroomStudent'
const CLASSROOM_YEARLEVEL_TABLE = 'ClassroomYearLevel'
const CLASSROOM_LEARNING_AREA_TABLE = 'ClassroomLearningArea'
const STUDENT_DATA_TABLE = 'StudentData'
// This is a new function to delete all records from the dynamo tables ( except the lookups)
// Its intended to be used only during testing - it empties all tables
export async function deleteSchoolDataFromDynamoDB() {
  const docClient = new AWS.DynamoDB.DocumentClient()
  // list of table to delete
  // SHOULD REALLY CHECK IF THE TABLE EXISTS FIRST
  let tablesList = [
    { tableName: SCHOOL_TABLE, partitionKeyName: 'id' },
    { tableName: STUDENT_TABLE, partitionKeyName: 'id' },
    { tableName: USER_TABLE, partitionKeyName: 'email' }, // note partition Key for User table
    { tableName: SCHOOL_STUDENT_TABLE, partitionKeyName: 'id' },
    { tableName: CLASSROOM_TABLE, partitionKeyName: 'id' },
    { tableName: CLASSROOM_TEACHER_TABLE, partitionKeyName: 'id' },
    { tableName: CLASSROOM_STUDENT_TABLE, partitionKeyName: 'id' },
    { tableName: CLASSROOM_YEARLEVEL_TABLE, partitionKeyName: 'id' },
    { tableName: CLASSROOM_LEARNING_AREA_TABLE, partitionKeyName: 'id' },
    //{ tableName: STUDENT_DATA_TABLE, partitionKeyName: 'id' },
  ]
  // first lets delete one data from one table
  // scan teh table
  let tableRecords = []

  // fn to scan in the records
  async function getAll(tableName) {
    let response = []
    let accumulated = []
    let ExclusiveStartKey
    do {
      try {
        response = await docClient
          .scan({
            TableName: tableName,
            ExclusiveStartKey,
          })
          .promise()
      } catch (err) {
        console.log(`error scanning table ${tableName}`, err)
      }

      ExclusiveStartKey = response.LastEvaluatedKey
      accumulated = [...accumulated, ...response.Items]
    } while (response.LastEvaluatedKey)
    return accumulated
  }

  // fn to delete the records in batchs
  async function deleteAll(records, tableName, partitionKeyName) {
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

  // now delete all the records in every table in list above
  // if a table is empty already it does nothing
  tablesList.forEach(async (table) => {
    tableRecords = await getAll(table.tableName)
    console.log(`${table.tableName} read and has ${tableRecords.length} records`)
    if (tableRecords.length > 0) {
      console.log(`Record 1 looks like ${tableRecords[1]}`)
      await deleteAll(tableRecords, table.tableName, table.partitionKeyName)
      console.log(`${table.tableName} deleted`)
    }
  })
} // end of test function deleteSchoolDataFromDynamoDB()

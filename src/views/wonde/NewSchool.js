import React, { useEffect, useState, useCallback, useContext } from 'react'
import loggedInContext from 'src/loggedInContext'
import { CContainer, CCol, CRow, CSpinner } from '@coreui/react'
import Button from 'devextreme-react/button'
import { DataGrid, MasterDetail, Selection, SearchPanel } from 'devextreme-react/data-grid'
import TabPanel, { Item } from 'devextreme-react/tab-panel'
import axios from 'axios'
import dayjs from 'dayjs'
import _ from 'lodash'
import { Auth } from 'aws-amplify'
import AWS from 'aws-sdk'
import { v4 } from 'uuid'
// Helper functions
import { getAllSchoolsFromWonde } from './helpers/getAllSchoolsFromWonde'
import { getStudentsFromWonde } from './helpers/getStudentsFromWonde'
import { getTeachersFromWonde } from './helpers/getTeachersFromWonde'
import { formatStudentClassrooms } from './helpers/formatStudentClassrooms'
import { saveSchool } from './helpers/saveSchool' // save it if it does not already exist in table School
import { deleteSchoolDataFromDynamoDB } from './helpers/deleteSchoolDataFromDynamoDB'
import { addNewCognitoUser, getCognitoUser } from './helpers/cognitoFns'
import { batchWrite } from './helpers/batchWrite'
import { getToken, getURL } from './helpers/wondeUrlToken'

// Note: We use env-cmd to read .env.local which contains environment variables copied from Amplify
// In production, the environment variables will be loaded automatically by the build script in amplify.yml
// For local starts, the amplify.yml script is not activated, so instead we use "> npm run start:local"
// This first runs the env-cmd that loads the environment variables prior to the main start script

//Lookup tables
const COUNTRY_TABLE = process.env.REACT_APP_COUNTRY_TABLE
const YEARLEVEL_TABLE = process.env.REACT_APP_YEARLEVEL_TABLE
const STATE_TABLE = process.env.REACT_APP_STATE_TABLE
//const LEARNINGAREA_TABLE = process.env.REACT_APP_LEARNINGAREA_TABLE

// Tables to store school data
// We need to generalise this for regional table names
// Maybe use a dynamo query to list the available table names?
const SCHOOL_TABLE = process.env.REACT_APP_SCHOOL_TABLE
const STUDENT_TABLE = process.env.REACT_APP_STUDENT_TABLE
const USER_TABLE = process.env.REACT_APP_USER_TABLE
const SCHOOL_STUDENT_TABLE = process.env.REACT_APP_SCHOOL_STUDENT_TABLE
const CLASSROOM_TABLE = process.env.REACT_APP_CLASSROOM_TABLE
const CLASSROOM_TEACHER_TABLE = process.env.REACT_APP_CLASSROOM_TEACHER_TABLE
const CLASSROOM_STUDENT_TABLE = process.env.REACT_APP_CLASSROOM_STUDENT_TABLE
const CLASSROOM_YEARLEVEL_TABLE = process.env.REACT_APP_CLASSROOM_YEARLEVEL_TABLE
//const CLASSROOM_LEARNINGAREA_TABLE = process.env.REACT_APP_CLASSROOM_LEARNINGAREA_TABLE
//const STUDENT_DATA_TABLE = process.env.REACT_APP_STUDENT_DATA_TABLE

// Not environment varible as this is not region-dependent
const SCHOOL_WONDE_INDEX = 'byWondeID'

// some constants for good practice
const EMPTY = 'EMPTY'
const BATCH_SIZE = 25 // for batchWrite() operations
const FAILED = 'failed'

// React component for user to list Wonde schools, read a school and upload the data to EdCompanion
function NewSchool() {
  const { loggedIn } = useContext(loggedInContext)
  // school list and slected school
  const [selectedSchool, setSelectedSchool] = useState({ schoolName: 'none' })
  const [schools, setSchools] = useState([])

  // These 2 save the raw data as loaded from Wonde
  const [wondeStudents, setWondeStudents] = useState([])
  const [wondeTeachers, setWondeTeachers] = useState([])

  // Next four are for the steduent-teacher and classroom-teacher displays
  const [displayStudents, setDisplayStudents] = useState([])
  const [displayTeachers, setDisplayTeachers] = useState([])
  const [displayStudentClassrooms, setDisplayStudentClassrooms] = useState([])
  const [displayTeacherClassrooms, setDisplayTeacherClassrooms] = useState([])

  // This one is for the upload display (as per the standard upload spreadsheet)
  const [studentClassrooms, setStudentClassrooms] = useState([])
  const [filteredStudentClassrooms, setFilteredStudentClassrooms] = useState([]) // after filters are applied

  // some loading indicators
  const [isLoadingSchools, setIsLoadingSchools] = useState(false)
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false)
  const [schoolDataLoaded, setSchoolDataLoaded] = useState(false)

  // lookup Tables - these are used by the uploader
  // to locate respective item ids
  const [countriesLookup, setCountriesLookup] = useState([])
  const [yearLevelsLookup, setYearLevelsLoookup] = useState([])
  const [statesLookup, setStatesLookup] = useState([])
  // const [learningAreasLookup, setLearningAreasLookup] = useState([])

  // This useEffect() reads and saves the contents of 4 lookups
  // It needs to run just once
  useEffect(() => {
    // we assume for now that the lookups are already populated in sandbox account

    const getLookupData = async () => {
      let credentials
      try {
        credentials = await Auth.currentCredentials()
      } catch (err) {
        console.log(err)
        return
      }

      AWS.config.update({
        credentials: credentials,
        region: 'ap-southeast-2',
      })
      const docClient = new AWS.DynamoDB.DocumentClient()
      let response
      response = await docClient.scan({ TableName: COUNTRY_TABLE }).promise()
      setCountriesLookup(response.Items)
      response = await docClient.scan({ TableName: YEARLEVEL_TABLE }).promise()
      setYearLevelsLoookup(response.Items)
      response = await docClient.scan({ TableName: STATE_TABLE }).promise()
      setStatesLookup(response.Items)
      // response = await docClient.scan({ TableName: LEARNINGAREA_TABLE }).promise()
      // setLearningAreasLookup(response.Items)
    }
    getLookupData()
    console.log('Loaded lookup tables from dynamoDB in UseEffect()')
  }, [])

  // This is for testing to delete all records form the Dynamo tables if they exist
  async function deleteAllTables() {
    await deleteSchoolDataFromDynamoDB()
  }

  // TEST FUNCTION FOR experimentation TO BE REMOVED LATER
  // There is  UI button that will run the function
  // Any sort of test function here is acceptable
  async function testFunction() {
    console.log('testFuntion() invoked')
    console.log('yearLevels', yearLevelsLookup)
    console.log('countries', countriesLookup)
    console.log('states', statesLookup)
    console.log('environment variables available')
    console.log(`REGION ${process.env.REACT_APP_REGION}`) //
    console.log(`USER_POOL_ID ${process.env.REACT_APP_USER_POOL_ID}`) //
    console.log(`USER_POOL_CLIENT_ID ${process.env.REACT_APP_USER_POOL_CLIENT_ID}`) //
    console.log(`ENDPOINT ${process.env.REACT_APP_ENDPOINT}`) //
    console.log(`IDENTITY_POOL(_ID) ${process.env.REACT_APP_IDENTITY_POOL}`)
    console.log(`USER_POOL_ID2 ${process.env.REACT_APP_USER_POOL_ID2}`)
    console.log(`USER_POOL_CLIENT_ID2 ${process.env.REACT_APP_USER_POOL_CLIENT_ID2}`)

    // try to locate a non-existant email
    // not bothering to try-catch these Cognito calls
    let response = await getCognitoUser(
      'randomJunk@northpol.com',
      process.env.REACT_APP_USER_POOL_ID2,
    )
    if (response === FAILED) console.log('email (randomJunk@northpol.com) does not exist')
    else {
      console.log(response)
    }
    // try to locate a known email
    response = await getCognitoUser(
      'testUser13@BPAdmin.com.au',
      process.env.REACT_APP_USER_POOL_ID2,
    )
    if (response === FAILED) console.log('email (randomJunk@northpol.com) does not exist')
    else {
      console.log(response) // should print the users details
    }
  } // end of testFuntion()

  // Invokes function to get the list of available schools from Wonde
  // first clears all state
  async function getAllSchools() {
    setIsLoadingSchools(true)
    setSchools([])
    setSelectedSchool({ schoolName: 'none' })
    setSchoolDataLoaded(false)
    // when loading the school list we clear teachers, students and classrooms
    setDisplayStudents([])
    setDisplayTeachers([])
    setDisplayStudentClassrooms([])
    setDisplayTeacherClassrooms([])

    // back to the business of this function
    let schools = await getAllSchoolsFromWonde(getURL(), getToken())
    if (schools) {
      setSchools(schools)
      setIsLoadingSchools(false)
    } else {
      console.log('could not read schools from Wonde')
    }
  }

  // this is executed if we select a school from the list of schools
  const selectSchool = useCallback((e) => {
    e.component.byKey(e.currentSelectedRowKeys[0]).done((school) => {
      setSelectedSchool(school)
      console.log(school)
    })
    setSchoolDataLoaded(false)
  }, [])

  // wrapper funtion triggered by "Get data for ..." button to read all school data
  async function getSchoolData() {
    if (selectedSchool === {}) return
    setSchoolDataLoaded(false)
    setIsLoadingStudents(true)
    let { wondeStudentsTemp } = await getStudentsFromWonde(
      selectedSchool.wondeID,
      setWondeStudents,
      setDisplayStudents,
      setDisplayStudentClassrooms,
    )
    setIsLoadingStudents(false)
    setIsLoadingTeachers(true)
    let { wondeTeachersTemp } = await getTeachersFromWonde(
      selectedSchool.wondeID,
      setWondeTeachers,
      setDisplayTeachers,
      setDisplayTeacherClassrooms,
    )
    setIsLoadingTeachers(false)
    formatStudentClassrooms(
      wondeStudentsTemp,
      wondeTeachersTemp,
      selectedSchool,
      setStudentClassrooms,
      setFilteredStudentClassrooms,
    ) // this is for the uploader format
    setSchoolDataLoaded(true)
  }

  // This is the new function to save a school to edComapnion based on the filtered CSV data
  async function saveSchoolCSVtoDynamoDB() {
    // See description of old loader at end of file
    if (!schoolDataLoaded) return // can't save unless data has been loaded
    console.log('Saving School to DynamoDB')

    /**
     * Save the selected school to School table if not already saves
     * returns the EC schoolID of the saved school
     */
    let schoolID // the EC id of the saved School
    try {
      schoolID = await saveSchool(
        selectedSchool,
        countriesLookup,
        statesLookup,
        SCHOOL_TABLE,
        SCHOOL_WONDE_INDEX,
      )
      console.log('School saved', schoolID)
    } catch (err) {
      console.log('error saving school', err)
    }

    // From here we assume [FilteredStudentClassrooms] contains filtered data
    // It has an artifical email address firstnamelastname@schoolname poked in
    // We scan [FilteredStudentClassrooms] to get unique classrooms, teachers and students for upload
    // Each row represents a student, a classroom and up to 5 teachers
    let uniqueClassroomsMap = new Map()
    let uniqueTeachersMap = new Map()
    let uniqueStudentsMap = new Map()

    filteredStudentClassrooms.forEach((row) => {
      // Make a unique list of classrooms
      if (!uniqueClassroomsMap.get(row.CwondeId)) {
        uniqueClassroomsMap.set(row.CwondeId, {
          wondeId: row.CwondeId, // not in EdC
          className: row.classroomName,
          yearCode: row.yearCode,
          MISID: row.mis_id,
        })
      }
      // Make a unique list of students
      if (!uniqueStudentsMap.get(row.SwondeId)) {
        uniqueStudentsMap.set(row.SwondeId, {
          email: row.email,
          wondeId: row.SwondeId, // not in EdC
          firstName: row.firstName,
          lastName: row.lastName,
          yearCode: row.yearCode,
          gender: row.gender,
          dob: row.dob,
        })
      }
      // Make a unique list of teachers
      for (let n = 0; n < 4; n++) {
        let wondeId = `T${n + 1} WondeId`
        let fnameKey = `teacher${n + 1} FirstName`
        let lnameKey = `teacher${n + 1} LastName`
        let emailKey = `teacher${n + 1} email`
        if (row[wondeId] !== '-') {
          // mostly 1 teacher
          if (!uniqueTeachersMap.get(row[wondeId])) {
            uniqueTeachersMap.set(row[wondeId], {
              wondeId: row[wondeId], // not in EdC
              firstName: row[fnameKey],
              lastName: row[lnameKey],
              email: row[emailKey],
            })
          }
        }
      }
    })

    // make th emaps into arrays for simpler processing
    const uniqueClassroomsArray = Array.from(uniqueClassroomsMap.values())
    const uniqueTeachersArray = Array.from(uniqueTeachersMap.values())
    const uniqueStudentsArray = Array.from(uniqueStudentsMap.values())

    console.dir(uniqueClassroomsArray)
    // console.dir(uniqueTeachersArray)
    // console.dir(uniqueStudentsArray)

    /**
     * Save the classrooms
     * For each classroom
          add to classrooms *
          add to classroomYearLevel
	        add to classroomLearningArea
     */

    try {
      console.time('Saved Classrooms') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(uniqueClassroomsArray.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = uniqueClassroomsArray.length % BATCH_SIZE // which could be 0
      // eg if 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

      // process each batch
      let index = 0 //index to uniqueClassroomsArray
      const schoolYear = parseInt(dayjs().format('YYYY'))
      for (let i = 0; i < 1; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < 1; n++) {
          let id = v4()
          const className = uniqueClassroomsArray[index].className
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: id, // this is the EdC id generated locally
                classType: 'Classroom',
                // focusGroupType: null, // its not a focus group
                className: className,
                schoolYear: schoolYear,
                schoolID: schoolID, // not in Wonde - generated above when saving the school
                wondeID: `${schoolID}${uniqueClassroomsArray[index].wondeId}`, // not in EdC
                MISID: uniqueClassroomsArray[index].MISID, // not in EdC
                __typename: 'Classroom',
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                'classType#schoolYear': `Classroom#${schoolYear}`,
                'schoolYear#className': `${schoolYear}#${className}`,
                // other optional fields not uploaded
                //    focusGroupType
              },
            },
          })
          uniqueClassroomsArray[index].classroomID = id // add the generated EC id for use below
          index++
        } // end batch loop

        console.log(`writing batch ${i} batchsize ${batchToWrite.length}`)
        let response = await batchWrite(batchToWrite, CLASSROOM_TABLE)
        console.log(response)

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Saved Classrooms')
    } catch (err) {
      console.log(err)
    } // end saving classrooms
    return
    // -----------------------------------------------------------------------
    // Now make a classroomTeacherArray for records to save in classroomTeachers
    // NB: Must be run AFTER classrooms are saved
    //     so the ClassroomID is available
    // First make a classroomTeacher array from the raw Wonde Teacher data
    let classroomTeachersArrayRaw = []
    wondeTeachers.forEach((teacher) => {
      teacher.classes.data.forEach((classroom) => {
        classroomTeachersArrayRaw.push({
          wondeClassroomId: classroom.id,
          wondeTeacherId: teacher.id,
          email: teacher.contact_details.data.emails.email,
        })
      })
    })
    // Then remove teachers and classrooms that were filtered out
    function validClassroomTeacher(row) {
      if (
        uniqueClassroomsMap.get(row.wondeClassroomId) &&
        uniqueTeachersMap.get(row.wondeTeacherId)
      ) {
        return true
      }
      return false
    }
    let classroomTeachersArrayTmp = classroomTeachersArrayRaw.filter((row) => {
      return validClassroomTeacher(row)
    })
    // now shape the array into {classroomId, email:email} objects for EdC
    let classroomTeachersArray = classroomTeachersArrayTmp.map((row) => {
      return {
        email: row.email,
        classroomID: uniqueClassroomsMap.get(row.wondeClassroomId).classroomID,
      }
    })

    /**
     * Save the classrooms
     * For each classroom
          add to classrooms
          add to classroomYearLevel *
	        add to classroomLearningArea
     */
    // Classrooms saves - next save classroomYearLevels
    console.log('saving ClassroomYearLevels')
    try {
      console.time('Saved ClassroomYearLevels') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(uniqueClassroomsArray.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = uniqueClassroomsArray.length % BATCH_SIZE // which could be 0
      // eg if 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

      // process each batch
      let index = 0 //index in the classrooms array
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          // lookup the yearLevelID to save
          let yearLevelRecord = yearLevelsLookup.find(
            // eslint-disable-next-line no-loop-func
            (o) => uniqueClassroomsArray[index].yearCode === o.yearCode,
            // Note yearCode looks like "Y0" to "Y12", Y0 = "FY", other = "K" (kindy)
          )

          //console.log("yearLevelRecord", yearLevelRecord);
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: v4(), // this is the EdC id generated locally
                classroomID: uniqueClassroomsArray[index].classroomID, // as poked in saving the classroom
                schoolID: schoolID, // not in Wonde - generated above when saving the school
                yearLevelID: yearLevelRecord.id,
                __typename: 'ClassroomYearLevel',
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
              },
            },
          })
          index++
        } // end batch loop

        let response = await batchWrite(batchToWrite, CLASSROOM_YEARLEVEL_TABLE)

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Saved ClassroomYearLevels')
    } catch (err) {
      console.log(err)
      return { result: false, msg: err.message } // abandon ship
    } // end save classrommYearLevel

    /**
     * Save the classrooms
     * For each classroom
          add to classrooms
          add to classroomYearLevel 
	        add to classroomLearningArea * ( currently no way to guess learningArea)
     */
    // NOTE: add classroomLearningArea NOT DONE

    // Save the teachers
    // add to user *
    // add to Cognito
    // add to schoolTeacher
    // add to classroomTeacher

    // This saves the teachers in table User
    try {
      console.time('Saved Teachers') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(uniqueTeachersArray.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = uniqueTeachersArray.length % BATCH_SIZE // which could be 0
      // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

      console.log('teachers batchesCount', batchesCount)
      console.log('teachers lastBatchSize', lastBatchSize)

      // process each batch
      let index = 0 //index in the teacherList array
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          let id = v4()
          // patch the teacher email if missing (often missing in Wonde)
          if (!uniqueTeachersArray[index].email) {
            uniqueTeachersArray[index].email = `${id}@placeholder.com`
          }
          batchToWrite.push({
            PutRequest: {
              Item: {
                userId: id, // this is the EdC id generated locally
                firstName: uniqueTeachersArray[index].firstName,
                lastName: uniqueTeachersArray[index].lastName,
                email: uniqueTeachersArray[index].email,
                userGroup: 'Users',
                userType: 'Educator', // or could be "Student"
                lastSignIn: '', // this will be a date
                userSchoolID: schoolID, // not in Wonde - generated above when saving the school
                wondeId: uniqueTeachersArray[index].wondeId, // not in EdC
                mis_id: 'to be included',
                enabled: false, // login enabled or not
                dbType: 'user',
                __typename: 'User',
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
              },
            },
          })
          uniqueTeachersArray[index].userID = id // save the ID for the ClassroomTeachers tables
          index++
        } // end batch loop

        //console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
        let response = await batchWrite(batchToWrite, USER_TABLE)
        //console.log(response);

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Saved Teachers')
    } catch (err) {
      console.log(err)
    } // end saving teachers

    // Save the teachers
    // add to user
    // add to Cognito *
    // add to classroomTeacher *
    try {
      console.time('saved teachers cognito')
      uniqueTeachersArray.forEach(async (teacher) => {
        let username = await addNewCognitoUser(teacher.email, process.env.REACT_APP_USER_POOL_ID2)
        if (username === FAILED)
          console.log(
            `Failed to create Cognito ${teacher.email} for ${teacher.firstName} ${teacher.lastName} `,
          )
      })
      console.timeEnd('saved teachers cognito')
    } catch (err) {}

    // Save the teachers
    // add to user
    // add to Cognito
    // add to classroomTeacher *

    try {
      console.time('Saved classroomTeachers') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(classroomTeachersArray.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = classroomTeachersArray.length % BATCH_SIZE // which could be 0
      // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

      console.log('classroomTeachers batchesCount', batchesCount)
      console.log('classroomTeachers lastBatchSize', lastBatchSize)

      // process each batch
      let index = 0 //index in the classroomTeachersArray array
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          let id = v4()
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: id, // this is the EdC id generated locally
                classroomID: classroomTeachersArray[index].classroomID,
                email: classroomTeachersArray[index].email,
                __typename: 'ClassroomTeacher',
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
              },
            },
          })
          index++
        } // end batch loop

        //console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
        let response = await batchWrite(batchToWrite, CLASSROOM_TEACHER_TABLE)
        //console.log(response);

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Saved classroomTeachers')
    } catch (err) {
      console.log(err)
      return { result: false, msg: err.message } // abandon ship
    } // end saving classroomTeachers

    //Save the Students
    //  add to student *
    //  add to user
    //  add to schoolStudent
    //  add to classroomStudent
    //  add to Cognito
    try {
      console.time('Saved Students') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(uniqueStudentsArray.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = uniqueStudentsArray.length % BATCH_SIZE // which could be 0
      // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

      console.log('Students batchesCount', batchesCount)
      console.log('Students lastBatchSize', lastBatchSize)

      // process each batch
      let index = 0 //index in the studentList array
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          // lookup the yearLevelID to save
          let yearLevelRecord = yearLevelsLookup.find(
            // eslint-disable-next-line no-loop-func
            (o) => o.yearCode === uniqueStudentsArray[index].yearCode,
          )
          //console.log('yearLevelRecord', yearLevelRecord)
          let id = v4()
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: id, // this is the EdC id generated locally
                firstName: uniqueStudentsArray[index].firstName,
                lastName: uniqueStudentsArray[index].lastName,
                middleName: '',
                gender: uniqueStudentsArray[index].gender,
                birthDate: uniqueStudentsArray[index].dob,
                yearLevelID: yearLevelRecord.id, // the lookup value
                wondeId: uniqueStudentsArray[index].wondeId, // not in EdC
                mis_id: 'to be included', // not in EdC
                __typename: 'Student', // used hard coded as tableName may change with env
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                // optional fields not populated
                // photo
              },
            },
          })
          uniqueStudentsArray[index].studentID = id // save the ID for tables below
          index++
        } // end batch loop

        // console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
        let response = await batchWrite(batchToWrite, STUDENT_TABLE)
        //console.log(response);

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Saved Students')
    } catch (err) {
      console.log(err)
    } // end saving students

    // -----------------------------------------------------------------------
    // Now make a classroomStudentArray for records to save in classroomStudents
    // NB: Must be run AFTER classrooms and Students are saved
    //     so the ClassroomID and StudentID are available
    // First make a classroomStudent array from the raw Wonde Student data
    let classroomStudentsArrayRaw = []
    wondeStudents.forEach((student) => {
      student.classes.data.forEach((classroom) => {
        classroomStudentsArrayRaw.push({
          wondeClassroomId: classroom.id, // its a Wonde id
          wondeStudentId: student.id, // also a Wonde id
        })
      })
    })
    // Then remove students and classrooms that were filtered out
    function validClassroomStudent(row) {
      if (
        uniqueClassroomsMap.get(row.wondeClassroomId) &&
        uniqueStudentsMap.get(row.wondeStudentId)
      ) {
        return true
      }
      return false
    }
    let classroomStudentsArrayTmp = classroomStudentsArrayRaw.filter((row) => {
      return validClassroomStudent(row)
    })
    // now shape the array into {classroomId, studentID} objects for EdC
    let classroomStudentsArray = classroomStudentsArrayTmp.map((row) => {
      return {
        classroomID: uniqueClassroomsMap.get(row.wondeClassroomId).classroomID,
        studentID: uniqueStudentsMap.get(row.wondeStudentId).studentID,
      }
    })
    //console.log('classroomStudentsArray', classroomStudentsArray)

    //Save the Students
    //  add to student *
    //  add to user *
    //  add to schoolStudent
    //  add to classroomStudent
    //  add to Cognito
    try {
      console.time('Saved Student Users') // measure how long it takes to save

      // in the case of Student users, many students have no email address which precludes them
      // from both having a User record or a Cognito record

      let uniqueStudentsArrayWithEmail = uniqueStudentsArray.filter((student) => {
        return student.email !== EMPTY
      })
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(uniqueStudentsArrayWithEmail.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = uniqueStudentsArrayWithEmail.length % BATCH_SIZE // which could be 0
      // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

      console.log('Students Users batchesCount', batchesCount)
      console.log('Students Users lastBatchSize', lastBatchSize)

      // process each batch
      let index = 0 //index in the studentList array
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          //console.log('yearLevelRecord', yearLevelRecord)
          let id = v4()
          batchToWrite.push({
            PutRequest: {
              Item: {
                userId: id, // this is the EdC id generated locally
                firstName: uniqueStudentsArrayWithEmail[index].firstName,
                lastName: uniqueStudentsArrayWithEmail[index].lastName,
                email: uniqueStudentsArrayWithEmail[index].email,
                userGroup: 'Users',
                userType: 'Student', // or could be "Educator"
                lastSignIn: '', // this will be a date
                userSchoolID: schoolID,
                wondeId: uniqueStudentsArrayWithEmail[index].wondeId, // of the student
                mis_id: 'to be included', // not in EdC
                enabled: false, // login enabled or not
                dbType: 'user',
                __typename: 'User',
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
              },
            },
          })
          index++
        } // end batch loop

        // console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
        let response = await batchWrite(batchToWrite, USER_TABLE)
        //console.log(response);

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Saved Student Users')
    } catch (err) {
      console.log(err)
    } // end saving student User

    //Save the Students
    //  add to student *
    //  add to user *
    //  add to schoolStudent *
    //  add to classroomStudent
    //  add to Cognito

    try {
      console.time('Saved SchoolStudents') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(uniqueStudentsArray.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = uniqueStudentsArray.length % BATCH_SIZE // which could be 0
      // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

      console.log('SchoolStudents batchesCount', batchesCount)
      console.log('SchoolStudents lastBatchSize', lastBatchSize)

      // process each batch
      let index = 0 //index in the studentList array
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          // lookup the yearLevelID to save
          let yearLevelRecord = yearLevelsLookup.find(
            // eslint-disable-next-line no-loop-func
            (o) => o.yearCode === uniqueStudentsArray[index].yearCode,
          )
          //console.log("yearLevelRecord", yearLevelRecord);
          let id = v4()
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: id, // this is the EdC id generated locally
                schoolID: schoolID,
                studentID: uniqueStudentsArray[index].studentID,
                schooolYear: dayjs().format('YYYY'),
                yearLevelID: yearLevelRecord.id, // the lookup value
                firstName: uniqueStudentsArray[index].firstName,
                lastName: uniqueStudentsArray[index].lastName,
                userId: '', // will be filled when student gets a login (its id not email!)
                __typename: 'SchoolStudent',
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
              },
            },
          })
          index++
        } // end batch loop

        //console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
        let response = await batchWrite(batchToWrite, SCHOOL_STUDENT_TABLE)
        //console.log(response);

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Saved SchoolStudents')
    } catch (err) {
      console.log(err)
    } // end saving schoolStudents

    //Save the Students
    //  add to student *
    //  add to user *
    //  add to schoolStudent *
    //  add to classroomStudent *
    //  add to Cognito
    try {
      console.time('Saved classroomStudents') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(classroomStudentsArray.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = classroomStudentsArray.length % BATCH_SIZE // which could be 0
      // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

      console.log('classroomStudents batchesCount', batchesCount)
      console.log('classroomStudents lastBatchSize', lastBatchSize)

      // process each batch
      let index = 0 //index in the classroomTeachersArray array
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          let id = v4()
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: id, // this is the EdC id generated locally
                classroomID: classroomStudentsArray[index].classroomID,
                studentID: classroomStudentsArray[index].studentID,
                __typename: 'ClassroomStudent',
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
              },
            },
          })
          index++
        } // end batch loop

        let response = await batchWrite(batchToWrite, CLASSROOM_STUDENT_TABLE)

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Saved classroomStudents')
    } catch (err) {
      console.log(err)
    } // end saving classroomStudents
  }

  // This is a Detail component to show student-classrooms assignments
  function StudentClassrooms(params) {
    let studentId = params.data.data.wondeStudentId
    let studentClassroomList = displayStudentClassrooms.filter((student) => {
      return student.wondeStudentId === studentId
    })

    return (
      <DataGrid
        showBorders={true}
        hoverStateEnabled={true}
        allowColumnReordering={true}
        columnAutoWidth={true}
        dataSource={studentClassroomList}
      ></DataGrid>
    )
  }

  // This is a Detail component to show teacher-classrooms assignments
  function TeacherClassrooms(params) {
    let teacherId = params.data.data.wondeTeacherId
    let teacherClassroomList = displayTeacherClassrooms.filter((teacher) => {
      return teacher.wondeTeacherId === teacherId
    })

    return (
      <DataGrid
        showBorders={true}
        hoverStateEnabled={true}
        allowColumnReordering={true}
        columnAutoWidth={true}
        dataSource={teacherClassroomList}
      ></DataGrid>
    )
  }

  if (!loggedIn.username) {
    return (
      <CContainer>
        <CRow>Please login first</CRow>
      </CContainer>
    )
  }
  return (
    <CContainer>
      <CRow>
        <h4 className="text-center">Wonde Integration - New School Uptake</h4>
      </CRow>
      <div className="d-flex justify-content-center">
        <Button
          className="btn btn-primary"
          style={{ marginBottom: '10px' }}
          onClick={getAllSchools}
        >
          List All Available Wonde Schools
        </Button>
        <Button className="btn btn-primary" style={{ marginBottom: '10px' }} onClick={testFunction}>
          run testFunction()
        </Button>
      </div>
      <CRow>
        <CCol></CCol>
        <CCol>
          {isLoadingSchools ? (
            <CSpinner />
          ) : (
            <DataGrid
              id="dataGrid"
              keyExpr="wondeID"
              showBorders={true}
              hoverStateEnabled={true}
              onSelectionChanged={selectSchool}
              allowColumnReordering={true}
              columnAutoWidth={true}
              dataSource={schools}
            >
              <Selection mode="single" />
            </DataGrid>
          )}
        </CCol>
        <CCol></CCol>
      </CRow>
      <CRow>
        <CCol></CCol>
        <CCol>
          <h6 className="text-center">Selected School:</h6>
        </CCol>
        <CCol>
          <h6 className="text-center">{selectedSchool.schoolName}</h6>
        </CCol>
        <CCol></CCol>
      </CRow>
      <div className="d-flex justify-content-center">
        {selectedSchool.schoolName !== 'none' ? (
          <Button
            className="btn btn-primary"
            style={{ marginBottom: '10px' }}
            onClick={getSchoolData}
          >
            {`Get data for ${selectedSchool.schoolName} from Wonde`}
          </Button>
        ) : null}
      </div>
      <div className="d-flex justify-content-center">
        {schoolDataLoaded ? (
          <>
            <Button
              className="btn btn-primary"
              style={{ marginBottom: '10px' }}
              onClick={saveSchoolCSVtoDynamoDB}
            >
              {`Save data for ${selectedSchool.schoolName} to EdCompanion`}
            </Button>
            <Button
              className="btn btn-primary"
              style={{ marginBottom: '10px' }}
              onClick={deleteAllTables}
              disabled={true}
            >
              {`Delete data for ${selectedSchool.schoolName} from EdCompanion`}
            </Button>
          </>
        ) : null}
      </div>

      <CRow>
        <TabPanel>
          <Item title="csv format - raw">
            <CContainer>
              <CRow>
                {isLoadingStudents ? (
                  <CSpinner />
                ) : (
                  <DataGrid
                    id="dataGrid"
                    //keyExpr="wondeStudentId"
                    showBorders={true}
                    hoverStateEnabled={true}
                    allowColumnReordering={true}
                    columnAutoWidth={true}
                    dataSource={studentClassrooms}
                  >
                    <SearchPanel visible={true} />
                  </DataGrid>
                )}
              </CRow>
            </CContainer>
          </Item>
          <Item title="csv format - filtered">
            <CContainer>
              <CRow>
                {isLoadingStudents ? (
                  <CSpinner />
                ) : (
                  <DataGrid
                    id="dataGrid"
                    //keyExpr="wondeStudentId"
                    showBorders={true}
                    hoverStateEnabled={true}
                    allowColumnReordering={true}
                    columnAutoWidth={true}
                    dataSource={filteredStudentClassrooms}
                  >
                    <SearchPanel visible={true} />
                  </DataGrid>
                )}
              </CRow>
            </CContainer>
          </Item>
          <Item title="Student-Classes">
            <CContainer>
              <CRow>
                {isLoadingStudents ? (
                  <CSpinner />
                ) : (
                  <DataGrid
                    id="dataGrid"
                    keyExpr="wondeStudentId"
                    showBorders={true}
                    hoverStateEnabled={true}
                    allowColumnReordering={true}
                    columnAutoWidth={true}
                    dataSource={displayStudents}
                  >
                    <SearchPanel visible={true} />
                    <MasterDetail enabled={true} component={StudentClassrooms} />
                  </DataGrid>
                )}
              </CRow>
            </CContainer>
          </Item>
          <Item title="Teacher-Classes">
            <CContainer>
              <CRow>
                {isLoadingTeachers ? (
                  <CSpinner />
                ) : (
                  <DataGrid
                    id="dataGrid"
                    keyExpr="wondeTeacherId"
                    showBorders={true}
                    hoverStateEnabled={true}
                    allowColumnReordering={true}
                    columnAutoWidth={true}
                    dataSource={displayTeachers}
                  >
                    <SearchPanel visible={true} />
                    <MasterDetail enabled={true} component={TeacherClassrooms} />
                  </DataGrid>
                )}
              </CRow>
            </CContainer>
          </Item>
        </TabPanel>
      </CRow>
    </CContainer>
  )
}
export default NewSchool
/**
 * Notes:
 * The code calling the existing lambda has a loop that is called onece for every "classroom"
 * Im not sure what a classroom data structure is - but probably is either
 * a) One line of the csv ( most probable)
 * b) grouped lines of the CSV
 * b) an invesion of the CSV data that shows classrooms
 */
/**
 * Pseudo code for Frank's old loader in EdCompanion
 * Passed in a datastructure that includes the classroom
 * The sequence is
 * a) GetClassroom() - reads or creates the classroom
 * b) process the teachers
 * c) process the students
 *
 * In Depth
 * a) Get or create the classroom based on schoolID, schoolYear and classname (GetClassroom())
 *    check if the classroom exists ( based on schoolID, schoolYear, classname - unique!)
 *          if creating a classroom
 *              for each year level in the classroom
 *                create classroomYearLevel entries
 *          if classroom already exists
 *              for each year level in the classroom
 *                    lookup the yearlevel ID
 *                     check if the classroom year level exists
 *                      if it does not exist
 *                            create the classroomYearlevel for that classroom
 *
 * b) process teachers
 *    for every teacher in the classroom
 *        call getTeacher(email) returns either null or the User entry
 *        if Null
 *           create the teacher createTeacher() - see details
 *        save the UserId
 *        if the teacher is found but the schoolID has changed AND its the current year
 *           update the User record to teh new schoolID (updateTeacher(teacher, schoolID))
 *        if the classroomTeacher record does not exist
 *           create the classroomTeacherRecord
 *
 *     createTeacher(teacher,schoolID) details
 *        if the cognitoUser does not exist
 *            create the Cognito user
 *            adding user to the  Users group
 *        add the teacher to the User table
 *
 * c) Process the students
 *    for every student in the classroom
 *        check if the students exists (by firstname, lastname, birthdate)
 *
 *        if the student does not exist
 *           change the birthdate format
 *           check again if the student exists
 *           if the student now exists
 *              update the birthdate in the Student table
 *
 *        get the yearLevel code for the student
 *
 *        if the student (still) does not exist
 *            create the record in Student table
 *
 *        if the student already exists
 *            update the record in Student table - including yearLevelID
 *
 *        when we reach here the student record exists!!
 *
 *        check if there is a record in SchoolStudent table
 *        if SchoolStudent record not exists
 *           create the record in SchoolStudent
 *        if exists
 *           if studentYearLevel is wrong - say a previous year
 *               update the studentYearlevel in Student table
 *
 *        check if there is a record in StudentData for that student for this year
 *            if no data
 *               check if there is a record in StudentData for that student for previous year
 *                  if data exists for previous year
 *                      carry over the data to the current year
 *
 *        check if there is already a record in studentClassroom - search by classroomID, studentID
 *            if no matching studentClassroom record
 *                 add the record to studentClassroom
 *
 *
 *  Suggested psedo code for Wonde uploader and updater
 *  Notes:
 *  1) We can extract data from Wonde in whatever way we like but start with this:
 *    school
 *     students ( a school can have many students)
 *       classrooms ( a student can belong to multiple classrooms)
 *          teachers ( a classroom can have multiple teachers)
 *
 *    First apply filter rules to:
 *       remove classrooms of no interest
 *       remove duplicate classrooms (esp Infant)
 *       convert yearLevel code
 *       make composite classroom names ( like "5 English")
 *
 *    First the new school case.......
 *    for every unique student (based on WondeID)
 *       verify the student does not exist in Student table (index wondeID#schoolID) - note could still be a duplicate name,birthdate from another non-Wonde school!
 *          if student not exists
 *              create the Student record ( look up the yearLevelID)
 *              create the SchoolStudent record
 *       verify the student is not already in Cognito
 *          if not in cognito
 *              add the student to Cognito, group Users
 *
 *   for every unique classroom ( based on WondeID)
 *
 *
 */

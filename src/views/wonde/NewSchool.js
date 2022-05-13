import React, { useEffect, useState, useCallback, useContext } from 'react'
import loggedInContext from 'src/loggedInContext'
import { CContainer, CCol, CRow } from '@coreui/react'
import Button from 'devextreme-react/button'
import { DataGrid, Selection, SearchPanel, Column, Export } from 'devextreme-react/data-grid'
import TabPanel, { Item } from 'devextreme-react/tab-panel'
import { confirm } from 'devextreme/ui/dialog' // confirmation dialog
import { LoadPanel } from 'devextreme-react/load-panel' // loading indicator

import dayjs from 'dayjs'
//import _ from 'lodash'
import { Auth } from 'aws-amplify'
import AWS from 'aws-sdk'
import { v4 } from 'uuid'
// Helper functions
import { getAllSchoolsFromWonde } from './NewSchoolHelpers/getAllSchoolsFromWonde'
import { getStudentsFromWonde } from './NewSchoolHelpers/getStudentsFromWonde'
import { formatStudentClassrooms } from './NewSchoolHelpers/formatStudentClassrooms'
import { OptionsPopup } from './NewSchoolHelpers/optionsPopup'
import { saveSchool } from './NewSchoolHelpers/saveSchool' // save it if it does not already exist in table School
import { deleteSchoolDataFromDynamoDB } from './NewSchoolHelpers/deleteSchoolDataFromDynamoDB'
import { addNewCognitoUser } from './NewSchoolHelpers/cognitoFns'
import { batchWrite } from './NewSchoolHelpers/batchWrite'
import { getRegion, getToken, getURL } from './CommonHelpers/featureToggles'
import { applyOptionsSchoolSpecific } from './CommonHelpers/applyOptionsSchoolSpecific' // for filtering the CSV data
import { CSVUploader } from './NewSchoolHelpers/CSVUploader' // for uploading CSV file to bucket
import { sendEmail } from './CommonHelpers/sendEmail'
import { getUploadedSchoolData } from './NewSchoolHelpers/getUploadedSchoolData'

// Note: We use env-cmd to read .env.local which contains environment variables copied from Amplify
// In production, the environment variables will be loaded automatically by the build script in amplify.yml
// For local starts, the amplify.yml script is not activated, so instead we use "> npm run start:local"
// This first runs the env-cmd that loads the environment variables prior to the main start script

//Lookup tables
const COUNTRY_TABLE = process.env.REACT_APP_COUNTRY_TABLE
const YEARLEVEL_TABLE = process.env.REACT_APP_YEARLEVEL_TABLE
const STATE_TABLE = process.env.REACT_APP_STATE_TABLE
const LEARNINGAREA_TABLE = process.env.REACT_APP_LEARNINGAREA_TABLE

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
const CLASSROOM_LEARNINGAREA_TABLE = process.env.REACT_APP_CLASSROOM_LEARNINGAREA_TABLE
//const STUDENT_DATA_TABLE = process.env.REACT_APP_STUDENT_DATA_TABLE

// Not environment varible as this is not region-dependent
const SCHOOL_WONDE_INDEX = 'byWondeID'

// Constant used to create the teacher and student entries in cognito
const USER_POOL_ID = process.env.REACT_APP_EDCOMPANION_USER_POOL_ID

// some constants for good practice
const BATCH_SIZE = 25 // for batchWrite() operations
const FAILED = 'failed'

// React component for user to list Wonde schools, read a school and upload the data to EdCompanion
function NewSchool() {
  const { loggedIn } = useContext(loggedInContext)

  // Some state variables to control the UI buttons and allowable actions
  const [selectedSchool, setSelectedSchool] = useState({ schoolName: 'none' })
  const [schools, setSchools] = useState([]) // contains data for all available Wonde Schools
  const [isUploaded, setIsUploaded] = useState(false) // set if selected school was previously uploaded
  const [isManuallyUploaded, setIsManuallyUploaded] = useState(false) // set if selected school was previously manually uploaded
  const [isWondeSchoolDataLoaded, setIsWondeSchoolDataLoaded] = useState(false) // set after the Wonde data is uploaded for selected school
  const [dataFilterPending, setDataFilterPending] = useState(false) // set after user accepts new filter options in the popup
  const [isDataFiltered, setIsDataFiltered] = useState(false) // Set after flter options are applied (by the useEffect)

  // Loading indicators for long DB operations
  const [isLoadingSchools, setIsLoadingSchools] = useState(false)
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [isSavingSchoolData, setIsSavingSchoolData] = useState(false)
  const [isDeletingSchoolData, setIsDeletingSchoolData] = useState(false)
  const [isSendingCSVToS3, setIsSendingCSVToS3] = useState(false)
  const [isAddingWondeIDs, setIsAddingWondeIDs] = useState(false) // for future use

  // controlling which tab is visible
  const [tabIndex, setTabIndex] = useState(0) // tab are numbersed 0....n

  // this controls the options popup
  const [optionsPopupVisible, setOptionsPopupVisible] = useState(false)

  // This saves the raw data as loaded from Wonde. Note: yearCode is added by getStudentsFormWonde()
  const [wondeStudents, setWondeStudents] = useState([])

  // This are polulated in getSchoolData().They are arrays of students, teachers and classrooms
  // already uploaded for the selected school - as read from DynamoDB
  const [uploadedClassrooms, setUploadedClassrooms] = useState([])
  const [uploadedTeachers, setUploadedTeachers] = useState([])
  const [uploadedStudents, setUploadedStudents] = useState([])

  // This one is for the CSV Format-RAW tab (as per the standard upload spreadsheet)
  const [studentClassrooms, setStudentClassrooms] = useState([])
  // This one is for the CSV Format-Filtered tab (as per the standard upload spreadsheet)
  const [filteredStudentClassrooms, setFilteredStudentClassrooms] = useState([]) // CSV data after filters are applied

  // lookup Tables - these are used by the uploader
  // to locate respective item ids
  const [countriesLookup, setCountriesLookup] = useState([])
  const [yearLevelsLookup, setYearLevelsLoookup] = useState([])
  const [statesLookup, setStatesLookup] = useState([])
  const [learningAreasLookup, setLearningAreasLookup] = useState([])

  // This is polulated in getSchoolData() and contains a list of
  // yearlevels available from Wonde for ths selected school, and whether each
  // year level is already uploaded to Wonde. It is passed to OptionsPopup()
  const [yearLevelStatusArray, setYearLevelStatusArray] = useState([])

  // These variables control the CSV filtering
  const [yearOptions, setYearOptions] = useState({
    Y1: false,
    Y2: false,
    Y3: false,
    Y4: false,
    Y5: false,
    Y6: false,
    Y7: false,
    Y8: false,
    Y9: false,
    Y10: false,
    Y11: false,
    Y12: false,
    Y13: false,
    K: false,
    R: false,
    FY: false,
  })
  const [kinterDayClasses, setKinterDayClasses] = useState(false) // false = dont include Mon-AM, Mon-PM etc
  const [kinterDayClassName, setKinterDayClassName] = useState('K-Mon-Fri') // string to use in place of Mon-AM etc
  const [coreSubjectOption, setCoreSubjectOption] = useState(false)

  function getFilterOptions() {
    console.log('get filter options')
    setOptionsPopupVisible(true)
  }

  // Button callback to add WondeIDs to manually uploaded school
  function AddWondeIDs() {
    console.log('Add WondeIDs to manually uploaded school- not implemented yet')
    return
  }

  // This useEffect() reads and saves the contents of 4 lookups
  // It needs to run just once
  useEffect(() => {
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
        region: getRegion(),
      })
      const docClient = new AWS.DynamoDB.DocumentClient()
      let response
      response = await docClient.scan({ TableName: COUNTRY_TABLE }).promise()
      setCountriesLookup(response.Items)
      response = await docClient.scan({ TableName: YEARLEVEL_TABLE }).promise()
      setYearLevelsLoookup(response.Items)
      response = await docClient.scan({ TableName: STATE_TABLE }).promise()
      setStatesLookup(response.Items)
      response = await docClient.scan({ TableName: LEARNINGAREA_TABLE }).promise()
      setLearningAreasLookup(response.Items)
    }
    getLookupData()
    console.log('Loaded lookup tables from dynamoDB in UseEffect()')
  }, [])

  // This is executed by the useEffect below after options have changed
  const applyFilterOptions = useCallback(() => {
    console.log('Applying filter options')
    console.log(yearOptions)

    // now applying the filter to the raw Wonde data
    // doco.js explains why we filter the raw data - then format
    // as opposed to filtering the formatted data.
    let filteredWondeStudents = applyOptionsSchoolSpecific(
      wondeStudents, // raw data from Wonde
      yearOptions,
      kinterDayClasses,
      kinterDayClassName,
      coreSubjectOption,
      selectedSchool,
    )
    let formattedFilteredCSV = formatStudentClassrooms(
      filteredWondeStudents,
      selectedSchool,
      setFilteredStudentClassrooms, // put the output into filteredStudentClassrooms
    ) // this is for the uploader format
    console.log('Formatted,Filtered Students from Wonde', formattedFilteredCSV)
    setIsDataFiltered(true)
  }, [
    wondeStudents, // raw data from Wonde
    yearOptions,
    kinterDayClasses,
    kinterDayClassName,
    coreSubjectOption,
    selectedSchool,
  ])

  // This useEffect() applies the option filters after user has accepted
  // options selections in the options popup
  useEffect(() => {
    if (dataFilterPending) {
      applyFilterOptions()
      setTabIndex(1) // navigate to the filtered Item in the TabPanel
      setDataFilterPending(false)
    }
  }, [applyFilterOptions, dataFilterPending])

  // This is for testing to delete all records from the Dynamo tables if they exist
  async function deleteAllTables() {
    // Do a final confirmation with the user
    let confirmed = await confirm(
      '<i>Are you sure?</i>',
      `Delete All Data from ${selectedSchool.schoolName}`,
    )
    console.log(`Confirm delete all data from ${selectedSchool.schoolName}`, confirmed)
    if (!confirmed) return
    setIsDeletingSchoolData(true) // loading indicator only
    await deleteSchoolDataFromDynamoDB(selectedSchool.wondeID)
    setIsDeletingSchoolData(false) // loading indicator only
    await getAllSchools() // refresh the display after deletion
  }

  // Create a CSV from the filtered data and send to S3
  // Callback for conditional Button below
  async function SendCSVToS3() {
    // Do a final confirmation with the user
    let confirmed = await confirm(
      '<i>Are you sure?</i>',
      `Send CSV data to S3 for school ${selectedSchool.schoolName}`,
    )
    console.log(`Confirm send CSV data to S3 for school ${selectedSchool.schoolName}`, confirmed)
    if (!confirmed) return

    setIsSendingCSVToS3(true) // loading indicator only
    console.log('loggedIn', loggedIn)
    let schoolName = loggedIn.schoolName
    await CSVUploader(schoolName, filteredStudentClassrooms)
    // Note: really need a table of verified email addresses for schools
    // Then, when a csv has been uploaded the notification goes to the school admin
    await sendEmail(
      'Notice of File Upload - BRENDAN TESTING NO ACTION NEEDED',
      `A csv file has been uploaded to S3 bucket for your school: ${schoolName}`,
      'brendan@bcperth.com', // sender
      [loggedIn.email], // array of addressees (needs to be the School Address)
      ['diego@bestperformance.com.au'], // array of cc'd addresees
    )
    setIsSendingCSVToS3(false) // loading indicator only
  }

  // TEST FUNCTION FOR experimentation TO BE REMOVED LATER
  // There is  UI button that will run the function
  // Any sort of test function here is acceptable

  async function testFunction() {
    console.log('testFuntion() invoked')
    console.log('yearLevels', yearLevelsLookup)
    console.log('countries', countriesLookup)
    console.log('states', statesLookup)
    console.log('learningAreas', learningAreasLookup)
    console.log('environment variables available')
    console.log(`REGION ${process.env.REACT_APP_REGION}`) //
    console.log(`USER_POOL_ID ${USER_POOL_ID}`) //
    console.log(`USER_POOL_CLIENT_ID ${process.env.REACT_APP_USER_POOL_CLIENT_ID}`) //
    // console.log(`ENDPOINT ${process.env.REACT_APP_ENDPOINT}`) //
    console.log(`IDENTITY_POOL(_ID) ${process.env.REACT_APP_IDENTITY_POOL_ID}`)

    // console.log('selectedSchool', selectedSchool)
    // if (selectedSchool.id) await getUploadedSchoolData(selectedSchool.id)
    // else {
    //   console.log('no school selected')
    // }
  } // end of testFuntion()

  //Function to get the list of Wonde schools already uploaded into DynamoDB
  async function getEdComSchools() {
    let credentials
    try {
      credentials = await Auth.currentCredentials()

      AWS.config.update({
        credentials: credentials,
        region: getRegion(),
      })
      const docClient = new AWS.DynamoDB.DocumentClient()
      let response
      response = await docClient.scan({ TableName: SCHOOL_TABLE }).promise()
      return response.Items
    } catch (err) {
      console.log(err)
      return []
    }
  } // end getEdComSchools()

  // Utility to remove spaces and hyphens from string and convert to upper case
  function compressString(str) {
    return str.replace(/'|\s/g, '').toUpperCase()
  }

  // Function to get the list of available schools from Wonde
  async function getAllSchools() {
    setIsLoadingSchools(true) // loading indicator
    setSchools([])
    setSelectedSchool({ schoolName: 'none' })
    setIsWondeSchoolDataLoaded(false)

    // we need the uploaded schools also to indicate "loaded" on the UI
    let edComSchools = await getEdComSchools()
    console.log('EdComSchools', edComSchools)

    // Get all the schools from Wonde
    let schools = await getAllSchoolsFromWonde(getURL(), getToken())
    if (schools) {
      let displaySchools = []
      schools.forEach((school) => {
        // check if there is a matching school name in EdCompanion/Elastik
        let matchingSchool = edComSchools.find(
          (x) => compressString(x.schoolName) === compressString(school.schoolName),
        )
        if (matchingSchool) {
          //console.log('matching School', matchingSchool)
          school.id = matchingSchool.id // we need the DynamoDB school id for later processing
          school.isLoaded = true
          // check if the school has a WondeID
          if (matchingSchool.wondeID) {
            school.isManual = false // Dynamo school has a wondeID
          } else {
            school.isManual = true // Dynamo school has been uploaded via csv
          }
        } else {
          // school is not uploaded
          school.isLoaded = false
          school.isManual = false
        }
        displaySchools.push({ ...school })
      })
      setSchools(displaySchools)
      setIsLoadingSchools(false) // loading indicator
    } else {
      console.log('could not read schools from Wonde')
    }
  }

  // this is executed if we select a school from the list of schools
  const selectSchool = useCallback((e) => {
    e.component.byKey(e.currentSelectedRowKeys[0]).done((school) => {
      setSelectedSchool(school)
      setIsUploaded(school.isLoaded)
      setIsManuallyUploaded(school.isManual)
      console.log('school at 330', school)
    })
    setIsWondeSchoolDataLoaded(false)
  }, [])

  // wrapper funtion triggered by "Get data for ..." button
  // to read all school data from Wonde
  async function getSchoolData(selectedSchool) {
    setTabIndex(0) // switch to the correct Wonde Data tab (unfltered)
    console.log('state', isUploaded, isManuallyUploaded)
    console.log('selected School', selectedSchool)
    setIsDataFiltered(false)
    if (selectedSchool === {}) return
    setIsWondeSchoolDataLoaded(false)
    setIsLoadingStudents(true) // loading indicator
    setStudentClassrooms([]) //empty the Wonde data TabPanel item
    setFilteredStudentClassrooms([]) // empty the filtered data TabPanel item

    // Get the students->classes->teachers.
    // TODO: rename getStudentsFromWonde() to getStudentClassroomsFormWOnde()
    let { wondeStudentsTemp } = await getStudentsFromWonde(selectedSchool.wondeID, setWondeStudents)
    console.log('Unformatted, Unfiltered Students from Wonde', wondeStudentsTemp)

    // Scan the Wonde data and make a Map of available year levels
    let yearLevelMap = new Map()
    let yearLevelArray = []
    wondeStudentsTemp.forEach((classroomStudent) => {
      if (!yearLevelMap.get(classroomStudent.yearCode))
        if (!classroomStudent.yearCode.startsWith('U')) {
          // Add to the map unless is some unrecognised code (marked as U-xxx by getStudentsFromWonde())
          let yearCode = classroomStudent.yearCode
          yearLevelMap.set(yearCode, yearCode)
          yearLevelArray.push(yearCode)
        }
    })
    // Sort by numberic year level
    yearLevelArray.sort((a, b) => {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })

    // Retrieve any data (year levels) already uploaded for this school
    // Note: uploadedClassrooms, uploadedeachers are used later when saving the school.
    let uploadedYearLevels = new Map()
    if (selectedSchool.isLoaded && !selectedSchool.isManual) {
      let { uploadedClassrooms, uploadedTeachers, uploadedStudents } = await getUploadedSchoolData(
        selectedSchool.id,
      )
      // save then for later use
      setUploadedClassrooms(uploadedClassrooms)
      setUploadedTeachers(uploadedTeachers)
      setUploadedStudents(uploadedStudents)

      //make a unique list of uploaded year codes (year codes are K,Y1 etc)
      uploadedStudents.forEach((student) => {
        if (!uploadedYearLevels.get(student.yearLevel.yearCode))
          uploadedYearLevels.set(student.yearLevel.yearCode, student.yearLevel.yearCode)
      })
      console.log('uploadedYearLevels', uploadedYearLevels)
    } else {
      // As good a place as any to clear the state variables
      setUploadedClassrooms([])
      setUploadedTeachers([])
      setUploadedStudents([])
      setYearLevelStatusArray([])
    }

    // Combine Wonde and DynamoDB data to make a list of available yearLevels from Wonde
    // indicating whether each year level is uploaded or not.
    let yearLevelStatusArray = yearLevelArray.map((item) => {
      let yearCode = item
      if (!isNaN(parseInt(item))) yearCode = `Y${item}`
      if (uploadedYearLevels.get(yearCode)) {
        return { yearLevel: yearCode, isLoaded: true }
      } else return { yearLevel: yearCode, isLoaded: false }
    })

    console.log('yearLevelStatusArray', yearLevelStatusArray)
    setYearLevelStatusArray(yearLevelStatusArray)

    // format as per csv uploader
    let formattedCSV = formatStudentClassrooms(
      wondeStudentsTemp,
      selectedSchool,
      setStudentClassrooms,
    )
    console.log('Formatted, Unfiltered StudentClassrooms from Wonde', formattedCSV)
    setIsWondeSchoolDataLoaded(true)
    setIsLoadingStudents(false) // loading indicator
  }

  /**
   * *********************************************************
   * Save the school,students,teachers, classes etc to Dynamo
   * edCompanion based on the filtered CSV data [FilteredStudentClassrooms]
   * *********************************************************
   */
  async function saveSchoolCSVtoDynamoDB(selectedSchool) {
    // Note: Can only reach here if school has not already been uploaded manually
    // School can either be not uploaded yet or has been uploaded already via BPAdmin
    // and now user wants to upload additional years
    // The UI state machine only exposes the "save school data" button when appropriate

    // Do a final confirmation with the user
    let confirmed = await confirm(
      '<i>Are you sure?</i>',
      `Upload data to ${selectedSchool.schoolName}`,
    )
    console.log(`Confirm upload data to ${selectedSchool.schoolName}`, confirmed)
    if (!confirmed) return

    setIsSavingSchoolData(true) // loading indicator

    // Just logging if this is a new upload or adding year levels
    if (selectedSchool.isLoaded) {
      console.log(`School ${selectedSchool.schoolName} is already loaded in DynamoDB`)
      console.log('There are checks below to see if additional year levels are being uploaded')
    } else {
      // School not in DynamoDB so we can proceed with full upload.
      console.log(`Saving school ${selectedSchool.schoolName} to DynamoDB`)
    }

    /**
     * SaveSchool() will either save the school and return the schooldID as saved
     * or will return the schoolID of the school if already saved
     */

    let response = {}
    try {
      response = await saveSchool(
        selectedSchool,
        countriesLookup,
        statesLookup,
        SCHOOL_TABLE,
        SCHOOL_WONDE_INDEX,
      )
    } catch (err) {
      console.log(`Error saving school ${selectedSchool.wondeID}`, err)
      return
    }
    let schoolID = response.schoolID // the EC id of the saved School

    // We scan [FilteredStudentClassrooms] to get unique classrooms, teachers and students for upload
    // Each row represents a student, a classroom and up to 5 teachers
    let uniqueClassroomsMap = new Map()
    let uniqueTeachersMap = new Map()
    let uniqueStudentsMap = new Map()

    // This map is used to store the teachers emails and the cognito username.
    // Later, based on the email, the userId will be updated properly.
    let teacherCognitoUserNames = new Map()

    // This array will be later used to create the classroomTeachers table
    let classroomTeachersFromCSV = []

    // Scan the filtered classrooms and make some unique lists
    filteredStudentClassrooms.forEach((row) => {
      // Make a unique list of classrooms
      // Also make an array of classroomTeachers - for later use
      if (!uniqueClassroomsMap.get(row.CwondeId)) {
        // If the classroom is "new" then we save its teachers
        // to be avaialble later to create the classroomTeachers table
        for (let n = 0; n < 4; n++) {
          let wondeId = `T${n + 1} WondeId`
          let emailKey = `teacher${n + 1} email`
          if (row[wondeId] !== '-') {
            classroomTeachersFromCSV.push({
              CwondeId: row.CwondeId, // later we swap this for the EdC classroom id
              email: row[emailKey],
            })
          }
        }
        uniqueClassroomsMap.set(row.CwondeId, {
          wondeId: row.CwondeId, // not in EdC
          className: row.classroomName,
          yearCode: row.yearCode,
          mis_id: row.Cmis_id,
          subject: row.subject ? row.subject : '-', // for use when saving classroomLearningArea
          // classroomID will be added after classroom are saved
        })
      }

      // Make a unique list of teachers
      for (let n = 0; n < 4; n++) {
        let wondeId = `T${n + 1} WondeId`
        let fnameKey = `teacher${n + 1} FirstName`
        let lnameKey = `teacher${n + 1} LastName`
        let emailKey = `teacher${n + 1} email`
        let mis_id = `T${n + 1} mis_id`
        if (row[wondeId] !== '-') {
          // mostly 1 teacher
          if (!uniqueTeachersMap.get(row[wondeId])) {
            uniqueTeachersMap.set(row[wondeId], {
              wondeId: row[wondeId], // not in EdC
              firstName: row[fnameKey],
              lastName: row[lnameKey],
              email: row[emailKey],
              mis_id: row[mis_id],
            })
          }
        }
      }

      // Make a unique list of students
      if (!uniqueStudentsMap.get(row.SwondeId)) {
        uniqueStudentsMap.set(row.SwondeId, {
          email: row.email, //email was generated in formatStudentClassrooms()
          // and looks like "firstnamelastname@schoolname" with no spaces
          wondeId: row.SwondeId, // not in EdC
          mis_id: row.Smis_id,
          firstName: row.firstName,
          middleName: row.middleName,
          lastName: row.lastName,
          yearCode: row.yearCode,
          gender: row.gender,
          dob: row.dob,
        })
      }
    })
    // If some of the selected yearlevels are already loaded, then we have to
    // remove them from the unique lists, so we dont try to upload them again
    // getUploadedSchoolData() returns unique lists of classrooms, students and teachers
    // that are already uploaded
    if (selectedSchool.isLoaded) {
      // Cull the 3 unique lists to remove classrooms, students and teachers already uploaded
      uploadedClassrooms.forEach((uploadedClassroom) => {
        let duplicateClassroom = uniqueClassroomsMap.get(uploadedClassroom.wondeID)
        if (duplicateClassroom) {
          console.log('Removing already uploaded classroom', uploadedClassroom)
          uniqueClassroomsMap.delete(uploadedClassroom.wondeID)
        }
      })
      uploadedStudents.forEach((uploadedStudent) => {
        let duplicateStudent = uniqueStudentsMap.get(uploadedStudent.student.wondeID)
        if (duplicateStudent) {
          console.log('Removing already uploaded student', uploadedStudent)
          uniqueStudentsMap.delete(uploadedStudent.student.wondeID)
        }
      })
      uploadedTeachers.forEach((uploadedTeacher) => {
        let duplicateTeacher = uniqueStudentsMap.get(uploadedTeacher.wondeID)
        if (duplicateTeacher) {
          console.log('Removing already uploaded teacher', uploadedTeacher)
          uniqueStudentsMap.delete(uploadedTeacher.wondeID)
        }
      })
    }

    // make the maps into arrays for simpler processing
    const uniqueClassroomsArray = Array.from(uniqueClassroomsMap.values())
    const uniqueTeachersArray = Array.from(uniqueTeachersMap.values())
    const uniqueStudentsArray = Array.from(uniqueStudentsMap.values())

    console.log('uniqueClassroomsArray', uniqueClassroomsArray)
    console.log('uniqueTeachersArray', uniqueTeachersArray)
    console.log('uniqueStudentsArray', uniqueStudentsArray)

    //console.log(learningAreasLookup)

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
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          let id = v4() // leave this here
          const className = uniqueClassroomsArray[index].className
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: id, // this is the EdC id generated above
                classType: 'Classroom',
                // focusGroupType: null, // its not a focus group
                className: className,
                schoolYear: schoolYear,
                schoolID: schoolID, // not in Wonde - generated above when saving the school
                wondeID: uniqueClassroomsArray[index].wondeId, // not in EdC
                MISID: uniqueClassroomsArray[index].mis_id, // not in EdC
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

    // -----------------------------------------------------------------------
    // Now make a classroomTeacherArray for records to save in classroomTeachers
    // NB: Must be run AFTER classrooms are saved
    // We already have classroomTeachersFromCSV[] constructed above
    // as an array of {CwondeID,email} objects
    // now shape the array into {classroomId, email} objects for EdC

    // let classroomTeachersArrayOld = classroomTeachersFromCSV.map((row) => {
    //   let classroom = uniqueClassroomsArray.find((classroom) => {
    //     return classroom.wondeId === row.CwondeId
    //   })
    //   return {
    //     classroomID: classroom.classroomID,
    //     email: row.email,
    //   }
    // })

    // this new version works when new yearLevels are being added

    // artificially add classroomID to uniqueClassroomsArray (REMOVE LATER)
    // uniqueClassroomsArray.forEach((classroom) => {
    //   classroom.classroomID = v4()
    // })
    console.log('classroomTeachersFromCSV', classroomTeachersFromCSV)
    console.log('uniqueClassroomsArray', uniqueClassroomsArray)
    let classroomTeachersArray = []
    classroomTeachersFromCSV.forEach((classroomTeacher) => {
      let foundClassroom = uniqueClassroomsArray.find((uniqueClassroom) => {
        return uniqueClassroom.wondeId === classroomTeacher.CwondeId
      })
      // Classroom may not exist in the uniqueClassroomsArray[] so check
      if (foundClassroom) {
        classroomTeachersArray.push({
          classroomID: foundClassroom.classroomID,
          email: classroomTeacher.email,
        })
      }
    })

    console.log('classroomTeachersArray', classroomTeachersArray)

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
          // get the yearCode for this classroom
          // Note yearCode must look like "Y0" to "Y12", Y0 = "FY", other = "K" (kindy)
          let yearCode = uniqueClassroomsArray[index].yearCode
          if (!isNaN(parseInt(uniqueClassroomsArray[index].yearCode)))
            yearCode = `Y${uniqueClassroomsArray[index].yearCode}`

          // lookup the yearLevelID for this yearCode
          let yearLevelRecord = yearLevelsLookup.find((o) => yearCode === o.yearCode)

          //console.log("yearLevelRecord", yearLevelRecord);
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: v4(), // this is the EdC id generated locally
                classroomID: uniqueClassroomsArray[index].classroomID, // as poked in when saving the classroom
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
	        add to classroomLearningArea *
     */
    //  new
    //  next save classroomLearningArea
    console.log('saving ClassroomLearningAreas')
    try {
      console.time('Saved ClassroomLearningAreas') // measure how long it takes to save
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
          // Extract the subject/areaName from the uniqueClassroom record
          let areaName = uniqueClassroomsArray[index].subject // subject will be defined at least as "-"
          // If its "Science (Ch)" or similar then make it "Science"
          if (areaName && areaName.startsWith('Science')) areaName = 'Science'
          // lookup the learningAreaID in the lookuptable
          let learningAreaRecord = learningAreasLookup.find((learningAreasLookupRow) => {
            return areaName === learningAreasLookupRow.areaName
          })

          if (learningAreaRecord) {
            // Only save if the classroom has a recognised subject/areaName
            //console.log("yearLevelRecord", yearLevelRecord);
            batchToWrite.push({
              PutRequest: {
                Item: {
                  id: v4(), // this is the EdC id generated locally
                  classroomID: uniqueClassroomsArray[index].classroomID, // as poked in saving the classroom
                  learningAreaID: learningAreaRecord.id,
                  __typename: 'ClassroomLearningArea',
                  createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                  updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                },
              },
            })
          }
          index++
        } // end batch loop

        let response = await batchWrite(batchToWrite, CLASSROOM_LEARNINGAREA_TABLE)

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Saved ClassroomLearningAreas')
    } catch (err) {
      console.log(err)
      return { result: false, msg: err.message } // abandon ship
    } // end save classrommLearningArea

    /**
     * Save the teachers
     *   add to Cognito *
     *   add to user
     *   add to classroomTeacher *
     */
    try {
      console.time('saved teachers cognito')

      for (let i = 0; i < uniqueTeachersArray.length; i++) {
        let teacher = uniqueTeachersArray[i]
        if (teacher.email) {
          console.log('Saving teacher to Cognito', teacher)
          let result = await addNewCognitoUser(teacher.email, USER_POOL_ID)
          if (result.username === FAILED) {
            console.log(
              `Failed to create Cognito ${teacher.email} for ${teacher.firstName} ${teacher.lastName} `,
            )
          } else {
            teacherCognitoUserNames.set(teacher.email, result.username)
          }
        } else {
          console.log(`Teacher has no email so not saved to Cognito`, teacher)
        }
      }
      console.timeEnd('saved teachers cognito')
    } catch (err) {}

    // Save the teachers
    // add to Cognito
    // add to user *
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
          let userId = teacherCognitoUserNames.get(uniqueTeachersArray[index].email)
          // if there is no userId returned by the cognito teacher map, then the record is not created in the user table
          if (!userId) continue
          batchToWrite.push({
            PutRequest: {
              Item: {
                userId, // username returned by Cognito
                firstName: uniqueTeachersArray[index].firstName,
                lastName: uniqueTeachersArray[index].lastName,
                email: uniqueTeachersArray[index].email,
                userGroup: 'Users',
                userType: 'Educator', // or could be "Student"
                enabled: false, // login enabled or not
                userSchoolID: schoolID, // not in Wonde - generated above when saving the school
                wondeID: uniqueTeachersArray[index].wondeId, // not in EdC
                MISID: uniqueTeachersArray[index].mis_id,
                dbType: 'user',
                __typename: 'User',
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                // fields not added lastSignIn
              },
            },
          })
          ///uniqueTeachersArray[index].userID = id // save the ID for the ClassroomTeachers tables
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
    //  add to Cognito (Not implemented)
    //  add to user    (Fix the error with UserID)
    //  add to schoolStudent
    //  add to classroomStudent

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
          // Find the yearCode for this student
          // Note yearCode must look like "Y0" to "Y12", Y0 = "FY", other = "K" (kindy)
          let yearCode = uniqueStudentsArray[index].yearCode
          if (!isNaN(parseInt(uniqueStudentsArray[index].yearCode)))
            yearCode = `Y${uniqueStudentsArray[index].yearCode}`

          // lookup the yearLevelID for this yearCode
          let yearLevelRecord = yearLevelsLookup.find((o) => yearCode === o.yearCode)
          //console.log('yearLevelRecord', yearLevelRecord)

          let id = v4()

          // Converting the original wonde values set for gender,dob to the ones required by the student table in dynamo
          let gender = uniqueStudentsArray[index].gender
          let dob = '1999-01-01'
          if (dayjs(uniqueStudentsArray[index].dob).isValid())
            dob = dayjs(uniqueStudentsArray[index].dob).format('YYYY-MM-DD')

          batchToWrite.push({
            PutRequest: {
              Item: {
                id: id, // this is the EdC id generated locally
                firstName: uniqueStudentsArray[index].firstName,
                lastName: uniqueStudentsArray[index].lastName,
                middleName: uniqueStudentsArray[index].middleName,
                gender,
                birthDate: dob,
                yearLevelID: yearLevelRecord.id, // the lookup value
                wondeID: uniqueStudentsArray[index].wondeId, // not in EdC
                MISID: uniqueStudentsArray[index].mis_id, // not in EdC
                __typename: 'Student', // used hard coded as tableName may change with env
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                'middleName#lastName#birthDate': `${uniqueStudentsArray[index].middleName}#${uniqueStudentsArray[index].lastName}#${dob}`,
                'lastName#birthDate': `${uniqueStudentsArray[index].lastName}#${dob}`,
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
    // NB: Run AFTER Classrooms and Students are saved so the ClassroomID and StudentID are available
    // filteredStudentClassrooms[] is already a classroom-student lookalike but has Wonde Ids
    // The task is to swap for EdCompanion/Elastik ids
    // Since being able to upload additional year levels filteredStudentClassrooms[] may
    // contain students that are already uploaded. Eg year 6 was previously uploaded and now
    // The filter option included year 6 and 7. So classroomStudentArray[] must only contain
    // year 7 records.
    // The process is to scan filteredStudentClassrooms (NOT Map since we have to remove records)
    // For each

    let classroomStudentsArray = []

    filteredStudentClassrooms.forEach((row) => {
      // locate the unique classroom - which now has the EdCompanion/Elastic classroomID
      let classroom = uniqueClassroomsArray.find((classroom) => {
        return classroom.wondeId === row.CwondeId
      })
      if (classroom) {
        // if the classroom still exists in uniqueClassroomsArray, locate the unique student
        let student = uniqueStudentsArray.find((student) => {
          return student.wondeId === row.SwondeId
        })
        if (student) {
          // save the record
          classroomStudentsArray.push({
            classroomID: classroom.classroomID,
            studentID: student.studentID, // studentID was set when the student was saved
          })
        }
      }
    })

    console.log('classroomStudentsArray', classroomStudentsArray)

    //Save the Students
    //  add to student *
    //  add to Cognito (Not implemented)
    //  add to user    (Fix the error with UserID)
    //  add to schoolStudent
    //  add to classroomStudent
    try {
      console.time('Saved Student Users') // measure how long it takes to save

      // Note: Student email addresses were added in formatStudentClassrooms()
      // email address is set as firstnamelastname@schoolname with all spaces removed

      // check for name clashes - ie duplicate email addresses and report
      let uniqueStudentNames = new Map()
      uniqueStudentsArray.forEach((student) => {
        if (!uniqueStudentNames.get(`${student.firstName}${student.lastName}`))
          uniqueStudentNames.set(`${student.firstName}${student.lastName}`)
        else console.log(`${student.firstName}${student.lastName} is duplicated`)
      })

      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(uniqueStudentsArray.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = uniqueStudentsArray.length % BATCH_SIZE // which could be 0
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
          let id = v4() // WRONG I THINK, Should be the username returned by Cognito (see teacher)
          batchToWrite.push({
            PutRequest: {
              Item: {
                userId: id, // WRONG I THINK, Should be the username returned by Cognito (see teacher)
                firstName: uniqueStudentsArray[index].firstName,
                lastName: uniqueStudentsArray[index].lastName,
                email: uniqueStudentsArray[index].email,
                userGroup: 'Users',
                userType: 'Student', // or could be "Educator"
                userSchoolID: schoolID,
                wondeID: uniqueStudentsArray[index].wondeId, // of the student
                MISID: uniqueStudentsArray[index].mis_id, // not in EdC
                enabled: false, // login enabled or not
                dbType: 'user',
                __typename: 'User',
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                // fields not added lastSignIn
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
    //  add to student
    //  add to Cognito (Not implemented)
    //  add to user    (Fix the error with UserID)
    //  add to schoolStudent *
    //  add to classroomStudent

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
          // find the yearCode for this student
          // Note yearCode looks like "Y0" to "Y12", Y0 = "FY", other = "K" (kindy)
          let yearCode = uniqueStudentsArray[index].yearCode
          if (!isNaN(parseInt(uniqueStudentsArray[index].yearCode)))
            yearCode = `Y${uniqueStudentsArray[index].yearCode}`

          // lookup the yearLevelID that matches the yearCode
          let yearLevelRecord = yearLevelsLookup.find((o) => yearCode === o.yearCode)

          //console.log("yearLevelRecord", yearLevelRecord);
          let id = v4()
          let schoolYear = parseInt(dayjs().format('YYYY'))
          let yearLevelID = yearLevelRecord.id
          let firstName = uniqueStudentsArray[index].firstName
          let lastName = uniqueStudentsArray[index].lastName
          let studentID = uniqueStudentsArray[index].studentID
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: id, // this is the EdC id generated locally
                schoolID: schoolID,
                studentID,
                schoolYear: schoolYear,
                yearLevelID, // the lookup value
                firstName: firstName,
                lastName: lastName,
                __typename: 'SchoolStudent',
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                'schoolYear#firstName': `${schoolYear}#${firstName}`,
                'schoolYear#lastName': `${schoolYear}#${lastName}`,
                'schoolYear#studentID': `${schoolYear}#${studentID}`,
                'schoolYear#yearLevelID': `${schoolYear}#${yearLevelID}`,
                'schoolYear#yearLevelID#firstName': `${schoolYear}#${yearLevelID}#${firstName}`,
                'schoolYear#yearLevelID#lastName': `${schoolYear}#${yearLevelID}#${lastName}`,
                // fields not added: userId: '' - will be filled when student gets a login (its id not email!)
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
    //  add to student
    //  add to Cognito (Not implemented)
    //  add to user   (Fix the error with UserID)
    //  add to schoolStudent
    //  add to classroomStudent *

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
      console.log('The uploading process has finished')
    } catch (err) {
      console.log(err)
    } // end saving classroomStudents
    setIsSavingSchoolData(false) // loading indicator
    await getAllSchools() // refresh the display after adding school data
  } // end saveSchoolCSVToDynamoDB()

  // changes the tab index using a state variable
  // since we are controlling the tab programmatically
  function handleTabIndexChange(e) {
    if (e.fullName === 'selectedIndex') {
      setTabIndex(e.value)
    }
  }

  // This function creates the correct <LoadPanel> is needed
  function createLoadPanel() {
    if (isLoadingSchools)
      return <LoadPanel visible={true} message={`Getting Available Wonde Schools`} />
    if (isLoadingStudents)
      return (
        <LoadPanel
          visible={true}
          message={`Getting Wonde data for "${selectedSchool.schoolName}"`}
        />
      )
    if (isSavingSchoolData)
      return (
        <LoadPanel visible={true} message={`Saving WOnde data to "${selectedSchool.schoolName}"`} />
      )
    if (isDeletingSchoolData)
      return (
        <LoadPanel
          visible={true}
          message={`Deleting Wonde data from "${selectedSchool.schoolName}"`}
        />
      )
    if (isSendingCSVToS3)
      return (
        <LoadPanel
          visible={true}
          message={`Sending Wonde data CSV to S3 for "${selectedSchool.schoolName}"`}
        />
      )
    if (isAddingWondeIDs)
      return (
        <LoadPanel visible={true} message={`Adding WondeIDs to "${selectedSchool.schoolName}"`} />
      )
    return <></>
  }

  // finally the UI
  if (!loggedIn.username) {
    return (
      <CContainer>
        <CRow>Please login first</CRow>
      </CContainer>
    )
  }
  return (
    <CContainer>
      {createLoadPanel()} {/* applies load indicators as needed */}
      <CRow>
        <div style={{ textAlign: 'center', fontSize: '30px' }}>
          <span>Wonde -</span> <span style={{ color: 'red' }}>New School Uptake</span>
        </div>
      </CRow>
      <div className="d-flex justify-content-center">
        <Button
          stylingMode="contained"
          style={{ marginBottom: '10px', marginRight: '5px', padding: '3px', borderRadius: '5px' }}
          type="default"
          onClick={getAllSchools}
        >
          List Wonde Schools
        </Button>
        {loggedIn.username === 'brendan' && (
          <Button style={{ marginBottom: '10px' }} stylingMode="outlined" onClick={testFunction}>
            run testFunction()
          </Button>
        )}
      </div>
      <CRow style={{ width: '50%', margin: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <CCol></CCol>
          <CCol>
            {!isLoadingSchools && (
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
        </div>
      </CRow>
      <CRow>
        <CCol></CCol>
        <div
          style={{
            textAlign: 'center',
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '7px',
          }}
        >
          <span style={{ marginRight: '10px' }}>Selected School:</span>
          <span style={{ color: 'red' }}>{`${selectedSchool.schoolName}`}</span>
        </div>
        <CCol></CCol>
        <CRow>
          {optionsPopupVisible ? (
            <OptionsPopup
              yearLevelStatusArray={yearLevelStatusArray}
              parentYearOptions={yearOptions}
              parentKindyOptions={kinterDayClasses}
              parentKindyClassName={kinterDayClassName}
              parentCoreSubjectOption={coreSubjectOption}
              setParentCoreSubjectOption={setCoreSubjectOption}
              setOptionsPopupVisible={setOptionsPopupVisible}
              setParentYearOptions={setYearOptions}
              setParentKinterDayClassName={setKinterDayClassName}
              setParentKinterDayClasses={setKinterDayClasses}
              setParentDataFilterPending={setDataFilterPending}
            ></OptionsPopup>
          ) : null}
        </CRow>
      </CRow>
      <div className="d-flex justify-content-center">
        {selectedSchool.schoolName !== 'none' && (
          <>
            <Button
              stylingMode="contained"
              style={{
                marginBottom: '10px',
                marginRight: '5px',
                padding: '3px',
                borderRadius: '5px',
              }}
              type="default"
              onClick={() => getSchoolData(selectedSchool)}
            >
              {`Get data for "${selectedSchool.schoolName}"`}
            </Button>
            {isWondeSchoolDataLoaded && (
              <Button
                stylingMode="contained"
                style={{ marginBottom: '10px', padding: '3px', borderRadius: '5px' }}
                type="default"
                onClick={getFilterOptions}
              >
                {`Set Filter Options`}
              </Button>
            )}
          </>
        )}
      </div>
      {selectedSchool.schoolName !== 'none' && (
        <div className="d-flex justify-content-center">
          {isWondeSchoolDataLoaded && isUploaded && !isManuallyUploaded && (
            <Button
              stylingMode="contained"
              style={{
                marginBottom: '10px',
                marginRight: '5px',
                padding: '3px',
                borderRadius: '5px',
              }}
              type="default"
              onClick={deleteAllTables}
            >
              {`Delete "${selectedSchool.schoolName}"`}
            </Button>
          )}
          {isWondeSchoolDataLoaded && isUploaded && isManuallyUploaded && (
            <Button
              stylingMode="contained"
              style={{
                marginBottom: '10px',
                marginRight: '5px',
                padding: '3px',
                borderRadius: '5px',
              }}
              type="default"
              onClick={AddWondeIDs}
            >
              {`Add Wonde IDs to "${selectedSchool.schoolName}"`}
            </Button>
          )}
          {isWondeSchoolDataLoaded &&
            isDataFiltered &&
            isUploaded &&
            !isManuallyUploaded &&
            filteredStudentClassrooms.length > 0 && (
              <Button
                stylingMode="contained"
                style={{
                  marginBottom: '10px',
                  marginRight: '5px',
                  padding: '3px',
                  borderRadius: '5px',
                }}
                type="default"
                onClick={saveSchoolCSVtoDynamoDB}
              >
                {`Upload "${selectedSchool.schoolName}"`}
              </Button>
            )}
          {isWondeSchoolDataLoaded && isDataFiltered && filteredStudentClassrooms.length > 0 && (
            <Button
              stylingMode="contained"
              style={{ marginBottom: '10px', padding: '3px', borderRadius: '5px' }}
              type="default"
              onClick={SendCSVToS3}
            >
              {`Send CSV to S3 for "${selectedSchool.schoolName}"`}
            </Button>
          )}
        </div>
      )}
      <CRow>
        <TabPanel selectedIndex={tabIndex} onOptionChanged={handleTabIndexChange}>
          <Item title="Wonde Data">
            <CContainer>
              <CRow>
                {!isLoadingStudents && (
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
                    <Export enabled={true} allowExportSelectedData={true} />
                    <Column caption="First Name" dataField="firstName" />
                    <Column caption="Middle Name" dataField="middleName" />
                    <Column caption="Last Name" dataField="lastName" />
                    <Column caption="Year Code" dataField="yearCode" />
                    <Column caption="Gender" dataField="gender" />
                    <Column caption="DOB" dataField="dob" />
                    <Column caption="Classroom Name" dataField="classroomName" />
                    <Column caption="Subject" dataField="subject" />
                    <Column caption="Teacher 1 First Name" dataField="teacher1 FirstName" />
                    <Column caption="Teacher 1 Last Name" dataField="teacher1 LastName" />
                    <Column caption="Teacher 1 Email" dataField="teacher1 email" />
                    <Column caption="Teacher 2 First Name" dataField="teacher2 FirstName" />
                    <Column caption="Teacher 2 Last Name" dataField="teacher2 LastName" />
                    <Column caption="Teacher 2 Email" dataField="teacher2 email" />
                    <Column caption="Teacher 3 First Name" dataField="teacher3 FirstName" />
                    <Column caption="Teacher 3 Last Name" dataField="teacher3 LastName" />
                    <Column caption="Teacher 3 Email" dataField="teacher3 email" />
                    <Column caption="Teacher 4 First Name" dataField="teacher4 FirstName" />
                    <Column caption="Teacher 4 Last Name" dataField="teacher4 LastName" />
                    <Column caption="Teacher 4 Email" dataField="teacher4 email" />
                    <Column caption="Teacher 5 First Name" dataField="teacher5 FirstName" />
                    <Column caption="Teacher 5 Last Name" dataField="teacher5 LastName" />
                    <Column caption="Teacher 5 Email" dataField="teacher5 email" />
                  </DataGrid>
                )}
              </CRow>
            </CContainer>
          </Item>
          <Item title="Filtered Data">
            <CContainer>
              <CRow>
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
                  <Export enabled={true} allowExportSelectedData={true} />
                  <Column caption="First Name" dataField="firstName" />
                  <Column caption="Middle Name" dataField="middleName" />
                  <Column caption="Last Name" dataField="lastName" />
                  <Column caption="Year Code" dataField="yearCode" />
                  <Column caption="Gender" dataField="gender" />
                  <Column caption="DOB" dataField="dob" />
                  <Column caption="Classroom Name" dataField="classroomName" />
                  <Column caption="Subject" dataField="subject" />
                  <Column caption="Teacher 1 First Name" dataField="teacher1 FirstName" />
                  <Column caption="Teacher 1 Last Name" dataField="teacher1 LastName" />
                  <Column caption="Teacher 1 Email" dataField="teacher1 email" />
                  <Column caption="Teacher 2 First Name" dataField="teacher2 FirstName" />
                  <Column caption="Teacher 2 Last Name" dataField="teacher2 LastName" />
                  <Column caption="Teacher 2 Email" dataField="teacher2 email" />
                  <Column caption="Teacher 3 First Name" dataField="teacher3 FirstName" />
                  <Column caption="Teacher 3 Last Name" dataField="teacher3 LastName" />
                  <Column caption="Teacher 3 Email" dataField="teacher3 email" />
                  <Column caption="Teacher 4 First Name" dataField="teacher4 FirstName" />
                  <Column caption="Teacher 4 Last Name" dataField="teacher4 LastName" />
                  <Column caption="Teacher 4 Email" dataField="teacher4 email" />
                  <Column caption="Teacher 5 First Name" dataField="teacher5 FirstName" />
                  <Column caption="Teacher 5 Last Name" dataField="teacher5 LastName" />
                  <Column caption="Teacher 5 Email" dataField="teacher5 email" />
                </DataGrid>
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
 * Notes: On How the EdCompanion CSV uploader works
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
// try to locate a non-existant email
// not bothering to try-catch these Cognito calls
// let response = await getCognitoUser('randomJunk@northpol.com', USER_POOL_ID)
// if (response === FAILED) console.log('email (randomJunk@northpol.com) does not exist')
// else {
//   console.log(response)
// }
// try to locate a known email
// response = await getCognitoUser('EltonLu@ChristChurchGrammarSchool', USER_POOL_ID)
// if (response === FAILED) console.log('email (EltonLu@ChristChurchGrammarSchool) does not exist')
// else {
//   console.log(response) // should print the users details
// }

// let result = await addNewCognitoUser('EltonLu@ChristChurchGrammarSchool', USER_POOL_ID)
// console.log('result after adding the user', result)

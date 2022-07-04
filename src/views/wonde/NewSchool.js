import React, { useEffect, useState, useCallback, useContext } from 'react'
import loggedInContext from 'src/loggedInContext'
import { CContainer, CCol, CRow } from '@coreui/react'
import Button from 'devextreme-react/button'
import {
  DataGrid,
  FilterRow,
  Selection,
  SearchPanel,
  Column,
  Export,
} from 'devextreme-react/data-grid'
import TabPanel, { Item } from 'devextreme-react/tab-panel'
import { confirm } from 'devextreme/ui/dialog' // confirmation dialog
import { LoadPanel } from 'devextreme-react/load-panel' // loading indicator

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
import {
  addNewStudentCognitoUser,
  addNewTeacherCognitoUser,
  addUserToGroup,
} from './NewSchoolHelpers/cognitoFns'
import { batchWrite } from './NewSchoolHelpers/batchWrite'
import { getRegion, getToken, getURL } from './CommonHelpers/featureToggles'
import { applyOptionsSchoolSpecific } from './CommonHelpers/applyOptionsSchoolSpecific' // for filtering the CSV data
import { CSVUploader } from './NewSchoolHelpers/CSVUploader' // for uploading CSV file to bucket
import { sendEmail } from './CommonHelpers/sendEmail'
import { getUploadedSchoolData } from './NewSchoolHelpers/getUploadedSchoolData'
import { GetAllSchoolsFromDynamoDB } from './NewSchoolHelpers/GetAllSchoolsFromDynamoDB'
// These functions are system utitities intended to be executed "run test function()" button
// that appears if Brendan is logged in
// dont delete
import { addWondeIDs } from './NewSchoolHelpers/AddWondeIDs' // for adding WondeIDs to WOnde schools that were uploaded manually
import { fixDobs } from './NewSchoolHelpers/fixDobs'

import dayjs from 'dayjs'
var customParseFormat = require('dayjs/plugin/customParseFormat')
dayjs.extend(customParseFormat)

// Note: We use env-cmd to read .env.local which contains environment variables copied from Amplify
// In production, the environment variables will be loaded automatically by the build script in amplify.yml
// For local starts, the amplify.yml script is not activated, so instead we use "> npm run start:local"
// This first runs the env-cmd that loads the environment variables prior to the main start script

const UNKNOWN = 'unknown'

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
  const [uploadedClassroomStudents, setUploadedClassroomStudents] = useState([])
  const [uploadedClassroomTeachers, setUploadedClassroomTeachers] = useState([])

  // These are to display students,teachers and classrooms from DynamoDB that cant be
  // positively matched to records in Wonde
  // Its populated in <AddWondeIDs>
  const [unmatchedStudents, setUnmatchedStudents] = useState([])

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

  // This is populated in getSchoolData() and contains a list of
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
  const [coreSubjectOption, setCoreSubjectOption] = useState(false) // rue if core subject only required
  const [saveToCognitoOption, setSaveToCognitoOption] = useState(false) // true to save the students to Cognito/Users
  const [mergePrimaryClassesOption, setMergePrimaryClassesOption] = useState(false) // set to merge primary classes with teh same teacher

  // Trigger opening the options popup
  function getFilterOptions() {
    console.log('get filter options')
    setOptionsPopupVisible(true)
  }

  // Button callback to add WondeIDs to manually uploaded school
  async function AddWondeIDs(selectedSchool) {
    // Do a final confirmation with the user
    let confirmed = await confirm(
      `<i>Add WondeIDs to ${selectedSchool.schoolName}</i>`,
      `Confirm Add WondIDs`,
    )
    console.log(`Confirm add WondeIDs to ${selectedSchool.schoolName}`, confirmed)
    if (!confirmed) return
    console.log(
      `Add WondeIDs to manually uploaded ${selectedSchool.schoolName} - not implemented yet`,
    )
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
      mergePrimaryClassesOption,
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
    mergePrimaryClassesOption,
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
  async function deleteAllTables(selectedSchool) {
    // Do a final confirmation with the user
    let confirmed = await confirm(
      `<i>Delete All data from ${selectedSchool.schoolName}</i>`,
      `Confirm Delete`,
    )
    console.log(`Confirm delete all data from ${selectedSchool.schoolName}`, confirmed)
    if (!confirmed) return
    setIsDeletingSchoolData(true) // loading indicator only
    await deleteSchoolDataFromDynamoDB(selectedSchool.wondeID)
    setIsDeletingSchoolData(false) // loading indicator only
    await listAllSchools() // refresh the display after deletion
    // data deleted from dynamoDB so clear the arrays
    setUploadedClassrooms([])
    setUploadedTeachers([])
    setUploadedStudents([])
    setUploadedClassroomStudents([])
    setUploadedClassroomTeachers([])
    setYearLevelStatusArray([])
    setStudentClassrooms([])
    setFilteredStudentClassrooms([])
  }

  // Create a CSV from the filtered data and send to S3
  // Callback for conditional Button below
  async function SendCSVToS3(selectedSchool) {
    // Do a final confirmation with the user
    let confirmed = await confirm(
      `<i>Send ${selectedSchool.schoolName} CSV data to S3</i>`,
      `Confirm Send CSV`,
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

  // TEST FUNCTION FOR as a dev aid TO BE REMOVED LATER
  // Appears only if Brendan Curtin is logged in
  async function testFunction() {
    console.log('testFuntion() invoked')
    // console.log('yearLevels', yearLevelsLookup)
    // console.log('countries', countriesLookup)
    // console.log('states', statesLookup)
    // console.log('learningAreas', learningAreasLookup)
    console.log('environment variables available')
    console.log(`REGION ${process.env.REACT_APP_REGION}`) //
    console.log(`EDCOMPANION COGNITO USER_POOL_ID ${USER_POOL_ID}`) //
    console.log(`BPADMIN COGNITO USER_POOL_ID ${process.env.REACT_APP_USER_POOL_ID}`) //
    console.log(`BPADMIN COGNITO USER_POOL_CLIENT_ID ${process.env.REACT_APP_USER_POOL_CLIENT_ID}`)
    console.log(`BPADMIN COGNITO IDENTITY_POOL_ID ${process.env.REACT_APP_IDENTITY_POOL_ID}`)

    // console.log('uploaded classroomStudents', uploadedClassroomStudents)
    // console.log('uploaded classroomTeachers', uploadedClassroomTeachers)
    addWondeIDs(selectedSchool)
    // test function to fix the dobs
    // fixDobs(selectedSchool)
  } // end of testFuntion()

  // Utility to remove spaces and hyphens from string and convert to upper case
  function compressString(str) {
    return str.replace(/'|\s/g, '').toUpperCase()
  }

  // Function to get the list of available schools from Wonde
  async function listAllSchools() {
    setIsLoadingSchools(true) // loading indicator
    setSchools([])
    setSelectedSchool({ schoolName: 'none' })
    setIsWondeSchoolDataLoaded(false)

    // we need the uploaded schools also to indicate "loaded" on the UI
    let edComSchools = await GetAllSchoolsFromDynamoDB()
    // console.log('EdComSchools', edComSchools, edComSchools.length)
    // edComSchools.forEach((school) => {
    //   console.log('school name', school.schoolName)
    // })

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

  // function to clear the options to their default values
  function clearOptions() {
    setYearOptions({
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
    setKinterDayClasses(false)
    setKinterDayClassName('K-Mon-Fri')
    setCoreSubjectOption(false)
    setSaveToCognitoOption(false)
    setMergePrimaryClassesOption(false)
  }

  // this is executed if we select a school from the list of schools
  const selectSchool = useCallback((e) => {
    e.component.byKey(e.currentSelectedRowKeys[0]).done((school) => {
      setSelectedSchool(school)
      setIsUploaded(school.isLoaded)
      setIsManuallyUploaded(school.isManual)
      setStudentClassrooms([])
      setFilteredStudentClassrooms([])
      setUnmatchedStudents([])
      clearOptions() // clear the popup options.
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
    let { wondeStudentsTemp } = await getStudentsFromWonde(selectedSchool.wondeID)
    setWondeStudents(wondeStudentsTemp) // save the raw response in case needed
    console.log('Unformatted, Unfiltered Students from Wonde', wondeStudentsTemp)

    // Scan the Wonde data and make a Map of available year levels
    let yearLevelMap = new Map()
    let yearLevelArray = []
    wondeStudentsTemp.forEach((classroomStudent) => {
      if (!yearLevelMap.get(classroomStudent.yearCode))
        if (!classroomStudent.yearCode.startsWith('U')) {
          // Add to the map unless is some unrecognised code
          // (marked as U - xxx by getYearCode in getStudentsFromWonde())
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
    // Note: uploadedClassrooms, uploadedTeachers are used later when saving the school.
    let uploadedYearLevels = new Map()
    console.log('Before retrieving DynamoData for selected school', selectedSchool)
    if (selectedSchool.isLoaded && !selectedSchool.isManual) {
      console.log('Retrieving DynamoData for selected school')
      let {
        uploadedClassrooms,
        uploadedTeachers,
        uploadedStudents,
        uploadedClassroomStudents,
        uploadedClassroomTeachers,
      } = await getUploadedSchoolData(selectedSchool.id, true)
      // save then for later use
      setUploadedClassrooms(uploadedClassrooms)
      setUploadedTeachers(uploadedTeachers)
      setUploadedStudents(uploadedStudents)
      setUploadedClassroomStudents(uploadedClassroomStudents)
      setUploadedClassroomTeachers(uploadedClassroomTeachers)

      //make a unique list of uploaded year codes (year codes are K,Y1 etc)
      uploadedStudents.forEach((student, index) => {
        if (index === 0) {
          console.log('***Sample student from DynamoDB****', student)
        }
        if (!uploadedYearLevels.get(student.yearLevel.yearCode))
          uploadedYearLevels.set(student.yearLevel.yearCode, student.yearLevel.yearCode)
      })
      console.log('uploadedYearLevels', uploadedYearLevels)
    } else {
      // As good a place as any to clear the state variables
      setUploadedClassrooms([])
      setUploadedTeachers([])
      setUploadedStudents([])
      setUploadedClassroomStudents([])
      setUploadedClassroomTeachers([])
      setYearLevelStatusArray([])
    }

    // Combine Wonde and DynamoDB data to make a list of available yearLevels from Wonde
    // indicating whether each year level is uploaded or not.
    let yearLevelStatusArray = []
    yearLevelArray.forEach((item) => {
      let yearCode = item
      if (yearCode === UNKNOWN) return // set by getYearCode() from getStudentsFromWonde()
      if (!isNaN(parseInt(item))) yearCode = `Y${item}`
      if (uploadedYearLevels.get(yearCode)) {
        yearLevelStatusArray.push({ yearLevel: yearCode, isLoaded: true })
      } else yearLevelStatusArray.push({ yearLevel: yearCode, isLoaded: false })
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
  } // end getSchoolData()

  /**
   * *********************************************************
   * Save the school,students,teachers, classes etc to Dynamo
   * edCompanion based on the filtered CSV data [FilteredStudentClassrooms]
   * *********************************************************
   */
  async function saveSchoolCSVtoDynamoDB(selectedSchool) {
    // Note: Can only reach here if school has not already been uploaded manually
    // We can be either loading the school from scratch or adding additional years
    // Its OK to load the same year repeatedly if new students, teachers etc have been added to Wonde
    // The UI state machine only exposes the "save school data" button when appropriate

    // Do a final confirmation with the user
    let confirmed = await confirm(
      `<i>Upload ${selectedSchool.schoolName} data</i>`,
      `Confirm Upload`,
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
    // TODO: Save school needs to set the enableStudentLogin bit to true, depending on the
    // savetoCognitoOption bit. Right now its forced to false, until the dynamoDB trigger on saves
    // to SChool tbale is disabled.
    let response = {}
    try {
      response = await saveSchool(
        selectedSchool,
        saveToCognitoOption, // true if students are to be allowed to login
        countriesLookup,
        statesLookup,
        SCHOOL_TABLE,
        SCHOOL_WONDE_INDEX,
      )
    } catch (err) {
      console.log(`Error saving school ${selectedSchool.schoolName}`, err)
      return
    }
    let schoolID = response.schoolID // the EC id of the saved School

    // We scan [FilteredStudentClassrooms] to get unique classrooms, teachers and students for upload
    // Each row represents a student, a classroom and up to 5 teachers
    let uniqueClassroomsMap = new Map()
    let uniqueTeachersMap = new Map()
    let uniqueStudentsMap = new Map()

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
          // Make ClassroomTeachers - Wonde Classroom ID to be later swopped for Dynamo classroom ID
          let wondeID = `T${n + 1} WondeId`
          let emailKey = `teacher${n + 1} email`
          if (row[wondeID] !== '-') {
            classroomTeachersFromCSV.push({
              wondeID: row.CwondeId, // later we swap this for the EdC classroom id
              email: row[emailKey],
            })
          }
        }
        uniqueClassroomsMap.set(row.CwondeId, {
          // Make a unique list of classrooms
          wondeID: row.CwondeId, // not in EdC
          className: row.classroomName,
          yearCode: row.yearCode,
          mis_id: row.Cmis_id,
          subject: row.subject ? row.subject : '-', // for use when saving classroomLearningArea
          // classroomID will be added after classroom are saved
        })
      }

      // Make a unique list of teachers
      for (let n = 0; n < 4; n++) {
        let wondeID = `T${n + 1} WondeId`
        let fnameKey = `teacher${n + 1} FirstName`
        let lnameKey = `teacher${n + 1} LastName`
        let emailKey = `teacher${n + 1} email`
        let mis_id = `T${n + 1} mis_id`
        if (row[wondeID] !== '-') {
          // mostly 1 teacher
          if (!uniqueTeachersMap.get(row[wondeID])) {
            uniqueTeachersMap.set(row[wondeID], {
              wondeID: row[wondeID], // not in EdC
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
          wondeID: row.SwondeId, // not in EdC
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
    // Make the maps into arrays for simpler processing
    const uniqueClassroomsArray = Array.from(uniqueClassroomsMap.values())
    const uniqueTeachersArray = Array.from(uniqueTeachersMap.values())
    const uniqueStudentsArray = Array.from(uniqueStudentsMap.values())

    console.log('uniqueClassroomsArray', uniqueClassroomsArray)
    console.log('uniqueTeachersArray', uniqueTeachersArray)
    console.log('uniqueStudentsArray', uniqueStudentsArray)
    console.log('classroomTeachersFromCSV', classroomTeachersFromCSV)

    //console.log(learningAreasLookup)

    /**
     * Save the classrooms
     * For each classroom
          save classrooms *
          save classroomYearLevel
	        save classroomLearningArea
     */

    // Remove already uploaded classrooms (matching wondeIDs) from the upload list
    let classroomsToUpload = []
    uniqueClassroomsArray.forEach((classroom) => {
      if (
        !uploadedClassrooms.find(
          (uploadedClassroom) => uploadedClassroom.wondeID === classroom.wondeID,
        )
      ) {
        classroomsToUpload.push(classroom)
      }
    })
    console.log('classrooms to upload', classroomsToUpload)

    try {
      console.time('Classrooms save time') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      // Note: parseInt() is supposed to work on strings but if passed a number like 15.7 it will round it down
      // presumably converting 15.7 to a string and then doings its thing (math.Floor() is probably better)
      let batchesCount = parseInt(classroomsToUpload.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = classroomsToUpload.length % BATCH_SIZE // which could be 0
      // eg if 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

      // process each batch
      let index = 0 //index to classroomsToUpload
      const schoolYear = parseInt(dayjs().format('YYYY'))
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          let id = v4() // leave this here
          const className = classroomsToUpload[index].className
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: id, // this is the EdC id generated above
                classType: 'Classroom',
                // focusGroupType: null, // its not a focus group
                className: className,
                schoolYear: schoolYear,
                schoolID: schoolID, // not in Wonde - generated above when saving the school
                wondeID: classroomsToUpload[index].wondeID, // not in EdC
                MISID: classroomsToUpload[index].mis_id, // not in EdC
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
          classroomsToUpload[index].classroomID = id // id for saving classroomLearningArea and classroomYearLevel

          index++
        } // end batch loop

        //console.log(`writing batch ${i} batchsize ${batchToWrite.length}`)
        let response = await batchWrite(batchToWrite, CLASSROOM_TABLE)
        console.log(response)

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Classrooms save time')
      console.log('No of classrooms uploaded:', classroomsToUpload.length)
    } catch (err) {
      console.log(err)
    } // end saving classrooms

    /**
     * Save the classrooms
     * For each classroom
          save classrooms
          save classroomYearLevel *
	        save classroomLearningArea
     */
    // Classrooms saves - next save classroomYearLevels
    console.log('saving ClassroomYearLevels')
    try {
      console.time('ClassroomYearLevels save time') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(classroomsToUpload.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = classroomsToUpload.length % BATCH_SIZE // which could be 0
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
          let yearCode = classroomsToUpload[index].yearCode
          if (!isNaN(parseInt(classroomsToUpload[index].yearCode)))
            yearCode = `Y${classroomsToUpload[index].yearCode}`

          // lookup the yearLevelID for this yearCode
          let yearLevelRecord = yearLevelsLookup.find((o) => yearCode === o.yearCode)

          //console.log("yearLevelRecord", yearLevelRecord);
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: v4(), // this is the EdC id generated locally
                classroomID: classroomsToUpload[index].classroomID, // as poked in when saving the classroom
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
      console.timeEnd('ClassroomYearLevels save time')
    } catch (err) {
      console.log(err)
      return { result: false, msg: err.message } // abandon ship
    } // end save classrommYearLevel

    /**
     * Save the classrooms
          save classrooms
          save classroomYearLevel
	        save classroomLearningArea *
     */
    console.log('saving ClassroomLearningAreas')
    try {
      console.time('ClassroomLearningAreas save time') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(classroomsToUpload.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = classroomsToUpload.length % BATCH_SIZE // which could be 0
      // eg if 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

      // process each batch
      let index = 0 //index in the classrooms array
      for (let i = 0; i < batchesCount; i++) {
        let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE
        if (batchSize === 0) break // must have been an even no of batches

        let batchToWrite = []
        for (let n = 0; n < batchSize; n++) {
          // Extract the subject/areaName from the uniqueClassroom record
          let areaName = classroomsToUpload[index].subject // subject will be defined at least as "-"
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
                  classroomID: classroomsToUpload[index].classroomID, // as poked in saving the classroom
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
      console.timeEnd('ClassroomLearningAreas save time')
    } catch (err) {
      console.log(err)
      return { result: false, msg: err.message } // abandon ship
    } // end save classrommLearningArea

    // -----------------------------------------------------------------------
    // Now make a classroomTeacherArray of records to save in classroomTeachers
    // NB: Must be run AFTER classrooms are saved
    // We also want to exclude ClassroomTeachers records that already exist
    // We also need to add ClassroomTeachers records where the classroom or teacher already
    // exists from a previous upload
    // classroomTeachersFromCSV[] as {CwondId,email}is the source of requsted classroomTeachers
    // uploadedClassroomTeachers[] as {classroom.wondeID,emai} is whats uploaded
    // Need to generate classroomTeachersArray[] an array of {classroomID,email}

    console.log('classroomTeachersFromCSV', classroomTeachersFromCSV)
    console.log('uniqueClassroomsArray', uniqueClassroomsArray)

    let classroomTeachersArray = []
    // remove all records from classroomTeachersFromCSV[] that were previously uploaded
    classroomTeachersFromCSV.forEach((CSVclassroomTeacher) => {
      if (
        !uploadedClassroomTeachers.find((uploadedClassroomTeacher) => {
          return (
            uploadedClassroomTeacher.email === CSVclassroomTeacher.email &&
            uploadedClassroomTeacher.classroomWondeID === CSVclassroomTeacher.wondeID
          )
        })
      ) {
        let classroomID = null
        // next try to locate the classroomID in uploadedClassrooms[] from a previous upload
        let foundClassroom = uploadedClassrooms.find(
          (uploadedClassroom) => CSVclassroomTeacher.wondeID === uploadedClassroom.wondeID,
        )
        if (foundClassroom) {
          classroomID = foundClassroom.id
        } else {
          // next try to locate the classroomID in classroomsToUpload (uploaded by now)
          foundClassroom = classroomsToUpload.find(
            (classroomToUpload) => CSVclassroomTeacher.wondeID === classroomToUpload.wondeID,
          )
          if (foundClassroom) {
            classroomID = foundClassroom.classroomID
          }
        }
        if (classroomID) {
          classroomTeachersArray.push({
            classroomID: classroomID,
            email: CSVclassroomTeacher.email,
          })
        } else {
          // A classroomID should always be found
          console.log(
            'Should not reach here - no matching classroomID for CSVclassroomTeacher',
            CSVclassroomTeacher,
          )
        }
      }
    })

    console.log('classroomTeachersArray', classroomTeachersArray)
    // -----------------------------------------------------------------------

    // Make teachersToUpload[] array that excludes teachers already in Dynamo
    let teachersToUpload = []
    uniqueTeachersArray.forEach((uniqueTeacher) => {
      if (
        !uploadedTeachers.find((uploadedTeacher) => uploadedTeacher.email === uniqueTeacher.email)
      ) {
        teachersToUpload.push(uniqueTeacher)
      }
    })
    console.log('Teachers to upload', teachersToUpload)

    /**
     * Save the teachers
     *   save Cognito *
     *   save user
     *   save classroomTeacher
     */
    try {
      console.time('Cognito teachers save time')

      for (let i = 0; i < teachersToUpload.length; i++) {
        let teacher = teachersToUpload[i]
        if (teacher.email) {
          console.log('Saving teacher to Cognito', teacher)
          let addTeacherResult = await addNewTeacherCognitoUser(
            teacher.email,
            USER_POOL_ID,
            teacher.firstName,
            teacher.lastName,
          )
          if (addTeacherResult.username === FAILED) {
            console.log(
              `Failed to create Cognito ${teacher.email} for ${teacher.firstName} ${teacher.lastName} `,
            )
          } else {
            // add the teacher to the "Users" Group so they can log in
            let addToUserGroupResult = await addUserToGroup(
              addTeacherResult.username,
              'Users',
              USER_POOL_ID,
            )
            console.log('addToUserGroupResult', addToUserGroupResult)
          }
          teachersToUpload[i].username = addTeacherResult.username // remember the username returned by Cognito or FAILED
        } else {
          console.log(`Teacher has no email so not saved to Cognito`, teacher)
        }
      }
      console.timeEnd('Cognito teachers save time')
    } catch (err) {
      console.log('error saving teachers to Cognito', err)
    } // end saving teachers to Cognito

    /**
     * Save the teachers
     *   save Cognito
     *   save user *
     *   save classroomTeacher
     */

    // This saves the teachers in table User
    try {
      console.time('Teachers User save time') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(teachersToUpload.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = teachersToUpload.length % BATCH_SIZE // which could be 0
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
          // if there is no userId returned by the cognito, then the record is not created in the user table
          if (teachersToUpload[index].username === FAILED) continue
          batchToWrite.push({
            PutRequest: {
              Item: {
                userId: teachersToUpload[index].username,
                firstName: teachersToUpload[index].firstName,
                lastName: teachersToUpload[index].lastName,
                email: teachersToUpload[index].email,
                userGroup: 'Users',
                userType: 'Educator', // "Student" if a student
                enabled: false, // login enabled or not
                userSchoolID: schoolID, // not in Wonde - generated above when saving the school
                wondeID: teachersToUpload[index].wondeID, // not in EdC
                MISID: teachersToUpload[index].mis_id,
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

        let response = await batchWrite(batchToWrite, USER_TABLE)
        //console.log(response);

        if (!response.result) {
          console.log(`exiting at index ${index}`)
          break
        }
      } // end array loop
      console.timeEnd('Teachers User save time')
    } catch (err) {
      console.log(err)
    } // end saving teachers

    /**
     * Save the teachers
     *   save Cognito
     *   save user
     *   save classroomTeacher *
     */

    // Note: classroomTeachersArray[] was constructed earlier to include possibly new
    // classroomTeacher assignments where either the teacher or classroom
    // was already in DynamoDB from an earlier upload. eg uploading a year level for a second time.
    try {
      console.time('ClassroomTeachers save time') // measure how long it takes to save
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
      console.timeEnd('ClassroomTeachers save time')
    } catch (err) {
      console.log(err)
      return { result: false, msg: err.message } // abandon ship
    } // end saving classroomTeachers

    //Save the Students
    //  save student *
    //  save Cognito
    //  save user
    //  save schoolStudent
    //  save classroomStudent

    // Make a new list of students to upload that excludes students already in Dynamo
    let studentsToUpload = []
    uniqueStudentsArray.forEach((uniqueStudent) => {
      if (
        !uploadedStudents.find(
          (uploadedStudent) => uploadedStudent.student.wondeID === uniqueStudent.wondeID,
        )
      ) {
        studentsToUpload.push(uniqueStudent)
      }
    })
    console.log('Students to upload', studentsToUpload)

    // Save the students in studentsToUpload[]
    try {
      console.time('Students save time') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(studentsToUpload.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = studentsToUpload.length % BATCH_SIZE // which could be 0
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
          let yearCode = studentsToUpload[index].yearCode
          if (!isNaN(parseInt(studentsToUpload[index].yearCode)))
            yearCode = `Y${studentsToUpload[index].yearCode}`

          // lookup the yearLevelID for this yearCode
          let yearLevelRecord = yearLevelsLookup.find((o) => yearCode === o.yearCode)

          // Convert the original wonde values set for gender,dob to the ones required by the student table in dynamo
          let gender = studentsToUpload[index].gender

          // All dobs here have been formatted as 'DD/MM/YYYY' or placeholder '01/01/1900'
          // dayJS needs to know we are passing 'DD/MM/YYYY' format (needs custtomParseFormat installed)
          let dob = dayjs(studentsToUpload[index].dob, 'DD/MM/YYYY').format('YYYY-MM-DD')
          let id = v4()
          batchToWrite.push({
            PutRequest: {
              Item: {
                id: id, // this is the EdC id generated locally
                firstName: studentsToUpload[index].firstName,
                lastName: studentsToUpload[index].lastName,
                middleName: studentsToUpload[index].middleName,
                gender,
                birthDate: dob,
                yearLevelID: yearLevelRecord.id, // the lookup value
                wondeID: studentsToUpload[index].wondeID, // not in EdC
                MISID: studentsToUpload[index].mis_id, // not in EdC
                __typename: 'Student', // used hard coded as tableName may change with env
                createdAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                updatedAt: `${dayjs(new Date()).format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`,
                'middleName#lastName#birthDate': `${studentsToUpload[index].middleName}#${studentsToUpload[index].lastName}#${dob}`,
                'lastName#birthDate': `${studentsToUpload[index].lastName}#${dob}`,
                // optional fields not populated
                // photo
              },
            },
          })
          studentsToUpload[index].studentID = id // save the ID for tables below
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
      console.timeEnd('Students save time')
    } catch (err) {
      console.log(err)
    } // end saving students

    //Save the Students
    //  save student
    //  save Cognito *    conditional on saveToCognito = true
    //  save user
    //  save schoolStudent
    //  save classroomStudent
    if (saveToCognitoOption) {
      try {
        console.time('Cognito students save time')

        for (let i = 0; i < studentsToUpload.length; i++) {
          let student = studentsToUpload[i]
          if (student.email) {
            console.log(`Saving student to Cognito ${i}`, student)
            let addStudentResult = await addNewStudentCognitoUser(
              student.email,
              USER_POOL_ID,
              student.firstName,
              student.lastName,
            )
            if (addStudentResult.username === FAILED) {
              console.log(
                `Failed to create Cognito ${student.email} for ${student.firstName} ${student.lastName} `,
              )
            } else {
              // add the student to the "Users" Group so they can log in
              let addToUserGroupResult = await addUserToGroup(
                addStudentResult.username,
                'Users',
                USER_POOL_ID,
              )
              console.log('addToUserGroupResult', addToUserGroupResult)
            }
            studentsToUpload[i].username = addStudentResult.username // remember the username returned by Cognito or FAILED
          } else {
            console.log(`Student has no email so not saved to Cognito`, student)
          }
        }
        console.timeEnd('Cognito students save time')
      } catch (err) {
        console.log('error saving students to Cognito', err)
      } // end saving students to Cognito}
    }

    //Save the Students
    //  save student
    //  save Cognito
    //  save user *       conditional on saveToCognito = true
    //  save schoolStudent
    //  save classroomStudent

    // TODO Urgent
    // check all student emails for uniqueness in Cognito, by looking up the email in table User
    // If it exists, add 1 to the end and try again. Keep incrementing until its not found.
    //if (saveToCognitoOption) {
    if (false) {
      try {
        console.time('Student Users save time') // measure how long it takes to save

        // Note: Student email addresses were added in formatStudentClassrooms()
        // email address is set as firstnamelastname@schoolname with all spaces removed

        // check for name clashes - ie duplicate email addresses and report
        let uniqueStudentNames = new Map()
        studentsToUpload.forEach((student) => {
          if (!uniqueStudentNames.get(`${student.firstName}${student.lastName}`))
            uniqueStudentNames.set(`${student.firstName}${student.lastName}`)
          else console.log(`${student.firstName}${student.lastName} is duplicated`)
        })

        // we have an array of items to batchWrite() in batches of up BATCH_SIZE
        let batchesCount = parseInt(studentsToUpload.length / BATCH_SIZE) + 1 // allow for remainder
        let lastBatchSize = studentsToUpload.length % BATCH_SIZE // which could be 0
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
            // if there is no userId returned by the cognito, then the record is not created in the user table
            if (studentsToUpload[index].username === FAILED) continue
            batchToWrite.push({
              PutRequest: {
                Item: {
                  userId: studentsToUpload[index].username,
                  firstName: studentsToUpload[index].firstName,
                  lastName: studentsToUpload[index].lastName,
                  email: studentsToUpload[index].email,
                  userGroup: 'Users',
                  userType: 'Student', // "Educator" if teacher
                  userSchoolID: schoolID,
                  wondeID: studentsToUpload[index].wondeID, // of the student
                  MISID: studentsToUpload[index].mis_id, // not in EdC
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
        console.timeEnd('Student Users save time')
      } catch (err) {
        console.log(err)
      } // end saving student User
    }

    //Save the Students
    //  save student
    //  save Cognito
    //  save user
    //  save schoolStudent *  TODO - fille in userID
    //  save classroomStudent

    try {
      console.time('Saved SchoolStudents') // measure how long it takes to save
      // we have an array of items to batchWrite() in batches of up BATCH_SIZE
      let batchesCount = parseInt(studentsToUpload.length / BATCH_SIZE) + 1 // allow for remainder
      let lastBatchSize = studentsToUpload.length % BATCH_SIZE // which could be 0
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
          let yearCode = studentsToUpload[index].yearCode
          if (!isNaN(parseInt(studentsToUpload[index].yearCode)))
            yearCode = `Y${studentsToUpload[index].yearCode}`

          // lookup the yearLevelID that matches the yearCode
          let yearLevelRecord = yearLevelsLookup.find((o) => yearCode === o.yearCode)

          //console.log("yearLevelRecord", yearLevelRecord);
          let id = v4()
          let schoolYear = parseInt(dayjs().format('YYYY'))
          let yearLevelID = yearLevelRecord.id
          let firstName = studentsToUpload[index].firstName
          let lastName = studentsToUpload[index].lastName
          let studentID = studentsToUpload[index].studentID
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
                userId: studentsToUpload[index].username,
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

    // -----------------------------------------------------------------------
    // Now make a classroomStudentArray for records to save in classroomStudents
    // NB: Run AFTER Classrooms and Students are saved so the ClassroomID and StudentID are available
    // We also want to exclude ClassroomStudent records that already exist
    // We also need to add ClassroomSTudent records where the classroom and or student
    // already exist in DynamoDB from a previous upload.
    // filteredStudentClassrooms[] is the source of requested classroomStudent records {CwondeId, SwondeId}
    // uploadedClassroomStudents[] as {classroom.wondeID,sudent.wondID} is whats uploaded

    console.log('filteredStudentClassrooms[]', filteredStudentClassrooms)
    /**
     *CwondeId: "A1391001079"
      SwondeId: "A1101487641"
     */
    console.log('uploadedClassroomStudents[]', uploadedClassroomStudents) //empty
    console.log('classroomsToUpload[]', classroomsToUpload)
    /**
     * className: "3E/En3"
      classroomID: "f9ecffff-75ed-48e0-a7b0-a3c5deacc648"
      mis_id: "28232"
      subject: "English"
      wondeID: "A1391001079"
     */
    console.log('uploadedClassrooms[]', uploadedClassrooms) //empty
    console.log('studentsToUpload[]', studentsToUpload)
    /**
     * dob: "03/05/2014"
        studentID: "e54520c0-5c6d-4bcb-bed8-2c5613b2d7cf"
        wondeID: "A1101487641"
        yearCode: "3"
     */
    console.log('uploadedStudents[]', uploadedStudents)

    let classroomStudentsArray = [] // this needs to end up as an array of {classroomID,studentID}

    // Remove all records from filteredStudentClassrooms[] that were previously uploaded
    filteredStudentClassrooms.forEach((row, index) => {
      // objective here is to make {classroomID,studentID} pairs
      let classroomID = null
      let studentID = null
      if (
        // if the classroomStudent is already uploaded then we skip it
        !uploadedClassroomStudents.find((uploadedClassroomStudent) => {
          return (
            row.CwondeId === uploadedClassroomStudent.classroomWondeID &&
            row.SwondeId === uploadedClassroomStudent.studentWondeID
          )
        })
      ) {
        // next try to locate the classroom in classroomsToUpload[] (uploaded above)
        let foundClassroom = classroomsToUpload.find(
          (classroomToUpload) => classroomToUpload.wondeID === row.CwondeId,
        )
        if (foundClassroom) {
          classroomID = foundClassroom.classroomID // as saved earlier
          console.log('found classroomID in classroomsToUpload', classroomID, index)
        } else {
          // next try to locate the classroom in uploadedClassrooms[] which were saved in a previous upload
          foundClassroom = uploadedClassrooms.find(
            (uploadedClassroom) => uploadedClassroom.wondeID === row.CwondeId,
          )
          if (foundClassroom) {
            classroomID = foundClassroom.id // as saved earlier
            console.log('found classroomID in uploadeClassrooms', classroomID, index)
          } else {
            console.log('Should not reach here Classroom wondeID not found', row)
            return
          }
        }
        // next try to locate the student in studentsToUpload[] (now uploaded)
        let foundStudent = studentsToUpload.find(
          (studentToUpload) => studentToUpload.wondeID === row.SwondeId,
        )
        if (foundStudent) {
          studentID = foundStudent.studentID
          console.log('found studentID in studentsToUpload', studentID, index)
        } else {
          // next try to locate the classroom in uploadedStudents[] which were saved in a previous upload
          foundStudent = uploadedStudents.find(
            (uploadedStudent) => uploadedStudent.student.wondeID === row.SwondeId,
          )
          if (foundStudent) {
            studentID = foundStudent.student.id // as saved earlier
            console.log('found studentID in uploadedStudents', studentID, index)
          } else {
            console.log('Should not reach here, student wondeID not found', row)
            return
          }
        }
        console.log('studentID && classroomID', studentID && classroomID, studentID, classroomID)
        if (studentID && classroomID) {
          classroomStudentsArray.push({ classroomID: classroomID, studentID: studentID })
        }
      } else {
        console.log('StudentClassroom is already uploaded')
      }
    })

    console.log('classroomStudentsArray', classroomStudentsArray)
    // ------------------------------------------------------------------------------

    //Save the Students
    //  save student
    //  save Cognito
    //  save user
    //  save schoolStudent
    //  save classroomStudent *

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
    await listAllSchools() // refresh the display after adding school data
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
        <LoadPanel visible={true} message={`Saving Wonde data to "${selectedSchool.schoolName}"`} />
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
          onClick={listAllSchools}
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
                height="350px"
              >
                <Selection mode="single" />
                <FilterRow visible={true} />
                <Column caption="School Name" dataField="schoolName" />
                <Column caption="Address 1" dataField="address1" allowFiltering={false} />
                <Column caption="Address 2" dataField="address2" allowFiltering={false} />
                <Column caption="Town" dataField="town" allowFiltering={false} />
                <Column caption="Country" dataField="country" allowFiltering={false} />
                <Column caption="Uploaded" dataField="isLoaded" />
                <Column caption="Manual" dataField="isManual" />
                <Column
                  caption="WondeID"
                  dataField="wondeID"
                  allowFiltering={false}
                  visibile={loggedIn.username === 'brendan'}
                />
                <Column
                  caption="dynamoDB ID"
                  dataField="id"
                  allowFiltering={false}
                  visible={loggedIn.username === 'brendan'}
                />
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
              parentSaveToCognitoOption={saveToCognitoOption}
              parentMergePrimaryClassesOption={mergePrimaryClassesOption}
              setParentYearOptions={setYearOptions}
              setParentKinterDayClasses={setKinterDayClasses}
              setParentKinterDayClassName={setKinterDayClassName}
              setParentCoreSubjectOption={setCoreSubjectOption}
              setParentSaveToCognitoOption={setSaveToCognitoOption}
              setParentMergePrimaryClassesOption={setMergePrimaryClassesOption}
              setOptionsPopupVisible={setOptionsPopupVisible}
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
              onClick={() => deleteAllTables(selectedSchool)}
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
              onClick={() => AddWondeIDs(selectedSchool)}
            >
              {`Add Wonde IDs to "${selectedSchool.schoolName}"`}
            </Button>
          )}
          {isWondeSchoolDataLoaded &&
            isDataFiltered &&
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
                onClick={() => saveSchoolCSVtoDynamoDB(selectedSchool)}
              >
                {`Upload "${selectedSchool.schoolName}"`}
              </Button>
            )}
          {isWondeSchoolDataLoaded && isDataFiltered && filteredStudentClassrooms.length > 0 && (
            <Button
              stylingMode="contained"
              style={{ marginBottom: '10px', padding: '3px', borderRadius: '5px' }}
              type="default"
              onClick={() => SendCSVToS3(selectedSchool)}
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
          {unmatchedStudents.length > 0 && (
            <Item title="Unmatched Students">
              <CContainer>
                <CRow>
                  <DataGrid
                    id="dataGrid"
                    //keyExpr="wondeStudentId"
                    showBorders={true}
                    hoverStateEnabled={true}
                    allowColumnReordering={true}
                    columnAutoWidth={true}
                    dataSource={unmatchedStudents}
                  >
                    <SearchPanel visible={true} />
                    <Column caption="First Name" dataField="firstName" />
                    <Column caption="Last Name" dataField="lastName" />
                    <Column caption="DoB" dataField="birthDate" />
                    <Column caption="Reason" dataField="reason" />
                    <Column caption="DynamoDB student ID" dataField="id" />
                  </DataGrid>
                </CRow>
              </CContainer>
            </Item>
          )}
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

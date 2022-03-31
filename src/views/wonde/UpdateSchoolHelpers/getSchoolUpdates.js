/**
 * The purpose of this file is to query Wonde for updates and then apply them to the EdC database.
 * There is a Confluence document that describes the chnages we are interested in,
 * how to detect them and how to update the dynamoDB tables.
 *
 * After lengthy discussions with Wonde (Colin Woolard) it transpires the updated_after filter
 * is less fine grained than originally expected. For example, if student updates are queried
 * the list of students with changes is returned, but despite earlier impressions, there is
 * no way to find how what was changed. It could have been the student details, contact details,
 * class assignments, year levels etc. This forces a simpler updating strategy as follows:
 *  If a student shows to be updated, then update everything in the database related to that student
 *  If a teachers shows to be updated, then update everything in the database related to that teacher
 *  If a class shows to be updated, then update everything in the database related to that class
 *
 * Note that the above changes are not mutually exclusive so all 3 query/updates are not needed in full
 * A more refined strategy would be:
 *   Query classroom changes - this will return
 *      new classes (ie new Wonde ID)
 *      classes where the name or other attribute has changed
 *      classes with changed student or teacher assignments
 *      if its a new classroom
 *      and has students attached
 *      and is a clasroom of interest (a primary school classroom or a relevant subject)
 *          add a record to classrooms
 *      if its an existing classroom
 *          update the Classroom table
 *
 *   Query student changes - this will return
 *      new students (ie new Wonde ID)
 *      students where the name or other attribute has changed
 *      students with changed classroom assignments
 *      If its a new student then
 *           add a record to Student table
 *           add a record to SchoolStudentTable
 *           add a record to ClassroomStudent for every classroom assignment
 *           add a Cognito record
 *      If its an existing student
 *           update the Student table
 *           Read the ClassroomStudent table and add/remove entries as needed
 *           No need to touch either the schoolStudent or Cognito
 *
 *    Query teacher changes ( ie users wih has-classes set) - this will return
 *      new teachers (ie new Wonde ID)
 *      teachers where the name or other attribute has changed
 *      teachers with changed classroom assignments
 *      If its a new teacher then
 *           add a record to Users table
 *           add a record to ClassroomTeacher for every classroom assignment
 *           add a Cognito record
 *      If its an existing teacher
 *           update the User table
 *           Read the ClassroomTeacher table and add/remove entries as needed
 *           No need to touch the Cognito record (email change?)
 *
 */
// Author: Brendan Curtin (commenced 15/03/2022)
const axios = require('axios')
const AWS = require('aws-sdk')
const getChangedStudents = require('./UpdateSchoolHelpers/getSchoolUpdates')
const getDeletions = require('./UpdateSchoolHelpers/getDeletions')
const processStudent = require('./UpdateSchoolHelpers/processStudent') // process updates for one student

//TODO - makes this regional
const AUSURL = 'https://api-ap-southeast-2.wonde.com/v1.0/schools'
const AUSTOKEN = 'Bearer 4ef8fc0053696f4202062ac598943fc1de66c606' // good for all AU schools

const afterDate = '2022-03-16 00:00:00' // formatted as per Wonde examples

/**
 * Wrap everything as an async funtion so we can use await
 */
async function processUpdates(schoolToUpdate) {
  /**
   * get set up for AWS service calls
   */
  const STUDENT_TABLE = 'Student-xuuhgbt2kzebrpxdv67rr5pmze-develop'
  const STUDENT_WONDE_INDEX = 'byWondeID'
  const credentials = new AWS.SharedIniFileCredentials({
    profile: '990939205853_AWSAdministratorAccess', // must update this every day!!
  }) // update the creds every day
  AWS.config.update({
    region: 'ap-southeast-2', // need to get this a better way
    credentials,
  })
  const docClient = new AWS.DynamoDB.DocumentClient()

  /**
   * Extract any students that have changed since the afterDate.
   * A student will show as changed if
   *      the student details have changed, including year level
   *      the student has been assigned or removed from a classroom
   * but can't find out the reason - so we update everything to do with the student
   */
  let changedStudents = await getChangedStudents(AUSURL, AUSTOKEN, schoolToUpdate, afterDate)
  console.log(`no of students with some changes since ${afterDate} = ${changedStudents.length}`)

  // process each changed student (change could mean a new student)
  changedStudents.forEach((student) =>
    processStudent(student, docClient, STUDENT_TABLE, STUDENT_WONDE_INDEX),
  )

  // check if any students have been deleted
  let deletedStudents = await getDeletions(AUSURL, AUSTOKEN, schoolToUpdate, 'student', afterDate)

  return true
}

// This is the entry point for the code
processUpdates().then((retStatus) => console.log(`returned ${retStatus}`))

// These to move to separate helper files

// get the classes that have been updated since "aferDate" (classrooms)
async function getClassesUpdates(url, token, currentSchool, afterDate) {
  let classrooms = []
  try {
    let URL = `${url}/${currentSchool.schoolID}/classes?updated_after=${afterDate}&include=subject,students&per_page=200`
    let morePages = true
    while (morePages) {
      console.log(URL)
      let response = await axios({
        method: 'get',
        url: URL,
        headers: {
          Authorization: token,
        },
      })
      // eslint-disable-next-line no-loop-func
      response.data.data.forEach((classroom) => {
        classrooms.push(classroom)
      })
      // check if all pages are read
      if (response.data.meta.pagination.next != null) {
        URL = response.data.meta.pagination.next
      } else {
        morePages = false
      }
    }
  } catch (error) {
    console.log(error)
  }

  return classrooms
}

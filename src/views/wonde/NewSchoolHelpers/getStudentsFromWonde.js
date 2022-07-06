import { getToken, getURL } from '../CommonHelpers/featureToggles'
import { getYearCode } from '../CommonHelpers/getYearCode'
import axios from 'axios'
import _ from 'lodash'
import { v4 } from 'uuid'

// gets the students list from one school - with classrooms and teachers
// Note - This has been removed from lambda due to the fluidity of filtering
// requirements so we are querying Wonde directly and filtering in browser
// at least during development

export async function getStudentsFromWonde(wondeSchoolID) {
  let wondeStudentsTemp = [] // the data as received from Wonde

  switch (wondeSchoolID) {
    case 'A1642105405': {
      //"Danes Hill" - This school has groups for years FY and Y1 and
      // classes for Y2-8
      let wondeStudentsTempGroups = await readStudentsGroupsTeachers(wondeSchoolID)
      let wondeStudentsTempClasses = await readStudentsClassesTeachers(wondeSchoolID)
      wondeStudentsTempGroups.forEach((student) => {
        // if any of these use the groups data
        if (student.yearCode === '1' || student.yearCode === 'FY' || student.yearCode === 'R')
          wondeStudentsTemp.push(student)
      })
      wondeStudentsTempClasses.forEach((student) => {
        // if not any of teh above use the classes data
        if (!(student.yearCode === '1' || student.yearCode === 'FY' || student.yearCode === 'R'))
          wondeStudentsTemp.push(student)
      })
      break
    }
    // these listed schools all use groups instead of classes (small primary schools)
    case 'A1802201454': /* St Monica's Catholic Primary School */
    case 'A1732060724': /* St Marks Primary School */
    case 'A1084772819': /* Mayville Primary School */
    case 'A509965888': {
      /* St Peter's Church of England Primary School */
      wondeStudentsTemp = await readStudentsGroupsTeachers(wondeSchoolID)
      break
    }
    default:
      wondeStudentsTemp = await readStudentsClassesTeachers(wondeSchoolID)
      break
  }

  //console.log('wondeStudentsTemp', wondeStudentsTemp)
  return { wondeStudentsTemp: wondeStudentsTemp }
}

// read students-groups-teachers for some primary schools
async function readStudentsGroupsTeachers(wondeSchoolID) {
  // first read the teachers who have groups
  let teachersMap = new Map()
  let teachersMap2 = new Map()
  try {
    let URL = `${getURL()}/${wondeSchoolID}/employees/?has_group=true&include=contact_details,groups&per_page=200`
    let response = await axios({
      method: 'get',
      url: URL,
      headers: {
        Authorization: getToken(),
      },
    })
    console.log('Teachers who are in groups:', response.data.data)
    // make a map of (teacher.id, email)
    response.data.data.forEach((teacher) => {
      let id = v4()
      let teacherEmail
      if (teacher.contact_details && teacher.contact_details.data.emails.email) {
        teacherEmail = teacher.contact_details.data.emails.email
      } else {
        teacherEmail = `${id}@placeholder.com` // insert placeholder if no email supplied
      }
      teachersMap.set(teacher.id, teacherEmail)
      //we need teacherMap2 to create emails from names below if needed when addings WondeIDs if AddWondeIDs.js
      teachersMap2.set(teacher.id, {
        forename: teacher.forename.toLowerCase(),
        surname: teacher.surname.toLowerCase(),
      })
    })
  } catch (err) {
    console.log(err)
    return []
  }

  console.log('teachers map', teachersMap)
  // Now process the students
  let wondeStudentsTemp = []
  try {
    let URL = `${getURL()}/${wondeSchoolID}/students?include=groups.employees,year&per_page=200`
    let morePages = true
    while (morePages) {
      console.log(URL)
      let response = await axios({
        method: 'get',
        url: URL,
        headers: {
          Authorization: getToken(),
        },
      })

      console.log('classes student response', response.data.data)

      // eslint-disable-next-line no-loop-func
      response.data.data.forEach((student) => {
        // Format the year code because its needed for filtering
        let clonedStudent = _.cloneDeep(student) // we need to avoid changing the original data
        clonedStudent.yearCode = getYearCode(clonedStudent, wondeSchoolID) // getting the right year code can be school specific
        // let classes = student.groups.data.filter((item) => {
        //   return item.type === 'YEAR'
        // })
        let classes = student.groups.data
        if (classes.length > 0) {
          // we only return students who are in groups
          clonedStudent.classes = {}
          clonedStudent.classes.data = []
          classes.forEach((classroom) => {
            classroom.employees.data.forEach((teacher) => {
              // insert the email for every teacher
              teacher.email = teachersMap.get(teacher.id)
              // some emails are wrong in St Monicas so we do this to fabricate the "correct" ones
              //let teacherName = teachersMap2.get(teacher.id)
              //let teacherEmail2 =
              //  `${teacherName.surname}` +
              //  teacherName.forename.charAt(0) +
              //  '.stmonicas@schools.sefton.gov.uk'
              //if (teacher.email !== teacherEmail2) {
              //  console.log('changing email from', teacher.email, 'to', teacherEmail2)
              //  teacher.email = teacherEmail2
              //}
              clonedStudent.classes.data.push(_.cloneDeep(classroom))
            })
          })
          wondeStudentsTemp.push(clonedStudent)
        } else {
          console.log(
            `Filtered out student ${student.forename} ${student.surname} ... not in any group`,
          )
        }
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
    return []
  }
  return wondeStudentsTemp
  //return []
}
/* **************************************************************************************/
// read the students-classes-teachers for secondary schools and large primary schools
async function readStudentsClassesTeachers(wondeSchoolID) {
  console.log('readStudentsClassesTeachers', wondeSchoolID)
  // first read the teachers who have classes
  let teachersMap = new Map()
  try {
    let URL = `${getURL()}/${wondeSchoolID}/employees/?has_class=true&include=contact_details,classes&per_page=200`
    let response = await axios({
      method: 'get',
      url: URL,
      headers: {
        Authorization: getToken(),
      },
    })

    // make a map of (teacher.id, email)
    response.data.data.forEach((teacher) => {
      let id = v4()
      let teacherEmail
      if (teacher.contact_details && teacher.contact_details.data.emails.email) {
        teacherEmail = teacher.contact_details.data.emails.email
      } else {
        teacherEmail = `${id}@placeholder.com` // insert placeholder if no email supplied
      }
      teachersMap.set(teacher.id, teacherEmail)
    })
  } catch (err) {
    console.log(err)
    return []
  }

  let wondeStudentsTemp = []
  try {
    let URL = `${getURL()}/${wondeSchoolID}/students?include=classes.employees,classes.subject,year&per_page=200`
    let morePages = true
    while (morePages) {
      console.log(URL)
      let response = await axios({
        method: 'get',
        url: URL,
        headers: {
          Authorization: getToken(),
        },
      })
      // eslint-disable-next-line no-loop-func
      response.data.data.forEach((student) => {
        // Format the year code because its needed for filtering
        let clonedStudent = _.cloneDeep(student) // we need to avoid changing the original data
        clonedStudent.yearCode = getYearCode(clonedStudent, wondeSchoolID) // getting the right year code can be school specific
        //console.log('cloned Student', clonedStudent)
        // now we want to insert the email of every teacher
        clonedStudent.classes.data.forEach((classroom) => {
          classroom.employees.data.forEach((teacher) => {
            teacher.email = teachersMap.get(teacher.id)
          })
        })
        wondeStudentsTemp.push(clonedStudent) // save the response data
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
    return []
  }
  return wondeStudentsTemp
}

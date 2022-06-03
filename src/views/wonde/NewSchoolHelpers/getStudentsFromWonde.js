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
  try {
    let URL = `${getURL()}/${wondeSchoolID}/employees/?has_group=true&include=contact_details,groups&per_page=200`
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

      // eslint-disable-next-line no-loop-func
      response.data.data.forEach((student) => {
        // Format the year code because its needed for filtering
        let clonedStudent = _.cloneDeep(student) // we need to avoid changing the original data
        clonedStudent.yearCode = getYearCode(clonedStudent, wondeSchoolID) // getting the right year code can be school specific
        let classes = student.groups.data.filter((item) => {
          return item.type === 'YEAR'
        })
        if (classes.length > 0) {
          // we only return students who are in groups
          clonedStudent.classes = {}
          clonedStudent.classes.data = []
          classes.forEach((classroom) => {
            classroom.employees.data.forEach((teacher) => {
              // insert the email for every teacher
              teacher.email = teachersMap.get(teacher.id)
            })
            clonedStudent.classes.data.push(_.cloneDeep(classroom))
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

import { getToken, getURL } from '../CommonHelpers/featureToggles'
import { getYearCode } from '../CommonHelpers/getYearCode'
import axios from 'axios'
import _ from 'lodash'

// gets the students list from one school - with classrooms and teachers
// Note - This has been removed from lambda due to the fluidity of filtering
// requirements so we are querying Wonde directly and filtering in browser
// at least during development

export async function getStudentsFromWonde(
  wondeSchoolID,
  setWondeStudents, // useState() set for wondeStudents
) {
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
  setWondeStudents(wondeStudentsTemp) // save the raw response in case needed
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
    //console.log('teachers', response.data.data)
    response.data.data.forEach((teacher) => {
      teachersMap.set(teacher.id, teacher.contact_details.data.emails.email)
    })
    //console.log(teachersMap)
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
          console.log(`Filtered out student ${student.forename} ${student.surname} ... no classes`)
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

// read the students-classes-teachers for secondary and large primaries
async function readStudentsClassesTeachers(wondeSchoolID) {
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
    //console.log('teachers', response.data.data)
    response.data.data.forEach((teacher) => {
      teachersMap.set(teacher.id, teacher.contact_details.data.emails.email)
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

// TODO - getStudentsFromWonde1() to de deleted
export async function getStudentsFromWonde1(
  wondeSchoolID,
  setWondeStudents, // useState() set for wondeStudents
  setDisplayStudents, //  useState() set for displayStudents
  setDisplayStudentClassrooms, //  useState() set for displayStudentClassrooms
) {
  let wondeStudentsTemp = [] // the data as received from Wonde
  let students = []
  let classrooms = []
  let noClassesCount = 0 // debug message to flag students with no clasrooms

  // see whats reported by deletions
  //let URL = `${getURL()}/${wondeSchoolID}/deletions?type=student&per_page=200`
  //let morePages = true
  //while (morePages) {
  //  console.log(URL)
  //  let response = await axios({
  //    method: 'get',
  //    url: URL,
  //    headers: {
  //      Authorization: getToken(),
  //    },
  //  })
  //  console.log('Deletions...', response)
  //  // check if all pages are read
  //  if (response.data.meta.pagination.next != null) {
  //    URL = response.data.meta.pagination.next
  //  } else {
  //    morePages = false
  //  }
  //}
  // read the students

  switch (wondeSchoolID) {
    case 'A1802201454': /* St Monica's Catholic Primary School */
    case 'A1732060724': /* St Marks Primary School */
    case 'A1084772819': {
      /* St Peter's Church of England Primary School */
      break
    }
    default:
      break
  }

  // read students-groups-teachers for some primary schools
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
    //console.log('Groups...', response)
    // check if all pages are read
    if (response.data.meta.pagination.next != null) {
      URL = response.data.meta.pagination.next
    } else {
      morePages = false
    }
  }

  // read the students-classes-teachers for secondary and large primaries
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
        wondeStudentsTemp.push(clonedStudent) // save the response data

        // NOTE: Remainer here is for the obsolescent student->classroom
        // and teachClassrom displays
        // only add classroom entries if the student is assigned to a class
        if (student.classes.data.length > 0) {
          student.classes.data.forEach((classroom) => {
            classrooms.push({
              wondeStudentId: student.id,
              mis_id: classroom.mis_id,
              wondeClassroomId: classroom.id,
              classroomName: classroom.name,
              yearLevel: student.year.data.code,
              teacherId:
                classroom.employees.data.length > 0 ? classroom.employees.data[0].id : 'no teacher',
            })
          })
        } else {
          noClassesCount++ // for debugging only
        }
        students.push({
          wondeStudentId: student.id,
          mis_id: student.mis_id,
          firstName: student.forename,
          lastName: student.surname,
          gender: student.gender ? student.gender : 'X',
          dob:
            student.date_of_birth && student.date_of_birth.date
              ? student.date_of_birth.date
              : '01/01/1999', // a placeholder dummy date
          year:
            // TODO this seems wrong or unneeded
            student.year && student.year.data && student.year.data.code
              ? student.year.data.code
              : 'no year',
        })
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
  console.log('no of students', students.length)
  console.log('no of classrooms', classrooms.length)
  console.log('no of students with no classrooms', noClassesCount)
  students = _.sortBy(students, ['year', 'wondeStudentId'])

  console.log('wondeStudentsTemp', wondeStudentsTemp)
  setWondeStudents(wondeStudentsTemp) // save the raw response in case needed
  setDisplayStudents(students)
  setDisplayStudentClassrooms(classrooms)
  return { wondeStudentsTemp: wondeStudentsTemp }
}

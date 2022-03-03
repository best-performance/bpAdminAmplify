import { getToken, getURL } from './featureToggles'
import axios from 'axios'
import dayjs from 'dayjs'
import _ from 'lodash'

// gets the students list from one school - with classrooms and teachers
// Note - This has been removed from lambda due to the fluidity of filtering
// requirements so we are querying Wonde directly and filtering in browser
// at least during development
export async function getStudentsFromWonde(
  wondeSchoolID,
  setWondeStudents, // sets the useState() variable
  setDisplayStudents, // sets the useState() variable
  setDisplayStudentClassrooms, // sets the useState() variable
) {
  let wondeStudentsTemp = [] // the data as received from Wonde
  let students = []
  let classrooms = []
  let noClassesCount = 0 // debug message to flag students with no clasrooms
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
        wondeStudentsTemp.push(student) // save the original response data
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
        // Date format now done in formatStudentClassrooms()
        // let dob = 'XXXX-XX-XX'
        // if (student.date_of_birth && student.date_of_birth.date) {
        //   dob = dayjs(student.date_of_birth.date).format('DD/MMM/YYYY')
        // }
        students.push({
          wondeStudentId: student.id,
          mis_id: student.mis_id,
          firstName: student.forename,
          lastName: student.surname,
          gender: student.gender ? student.gender : 'X',
          dob:
            student.date_of_birth && student.date_of_birth.date
              ? student.date_of_birth.date
              : 'XX/XX/XXXX',
          year:
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
  //students = _.sortBy(students, [(y) => parseInt(y.year)])
  students = _.sortBy(students, ['year', 'wondeStudentId'])

  setWondeStudents(wondeStudentsTemp) // save the raw response in case needed
  setDisplayStudents(students)
  setDisplayStudentClassrooms(classrooms)
  return { wondeStudentsTemp: wondeStudentsTemp }
}

import { getToken, getURL } from './wondeUrlToken'
import axios from 'axios'

// local function to find/guess a class's learning Area (relocated from the lambda)
function getLearningArea(className) {
  // must be one of Mathematics, English, Technology, Science
  let classNameUpper = className.toUpperCase()
  if (classNameUpper.includes('MATH')) {
    return 'Mathematics'
  }
  if (classNameUpper.includes('ENGL')) {
    return 'English'
  }
  if (classNameUpper.includes('SCI')) {
    return 'Science'
  }
  if (classNameUpper.includes('TECHN') || classNameUpper.includes('IT APP')) {
    return 'Technology'
  }
  return false
}

// gets the teachers from one school, with their contact details
// Note - This has been rmeoved from lambda due to the fluidity of filtering
// requirements so we are querying Wonde directly and filtering in browser
// where its easy and fast,
export async function getTeachersFromWonde(
  wondeSchoolID,
  setWondeTeachers,
  setDisplayTeachers,
  setDisplayTeacherClassrooms,
) {
  let wondeTeachersTemp = []
  let classrooms = [] // only classrooms from teh core 4 learning areas
  let teachers = [] // only teachers that teach at least one of the 4 core learning areas
  try {
    let URL = `${getURL()}/${wondeSchoolID}/employees/?has_class=true&include=contact_details,classes&per_page=200`
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
      response.data.data.forEach((employee) => {
        wondeTeachersTemp.push(employee) // save the original response data
        // under new rules we load all teachers and their classrooms
        employee.classes.data.forEach((classroom) => {
          let learningArea = getLearningArea(classroom.name) // returns either false or the learning Area
          // under new rules we allows all teachers even if not core 4
          classrooms.push({
            wondeTeacherId: employee.id,
            wondeClassroomId: classroom.id,
            classroomName: classroom.name,
            classroomLearningArea: learningArea ? learningArea : null, // return learning area if available
          })
        })
        // under new rules we load all teachers
        teachers.push({
          wondeTeacherId: employee.id,
          mis_id: employee.mis_id,
          title: employee.title,
          firstName: employee.forename,
          lastName: employee.surname,
          email: employee.contact_details.data.emails.email,
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
    console.log('error reading Wonde teachers', error.message)
    return { result: false, msg: error.message }
  }
  setWondeTeachers(wondeTeachersTemp)
  setDisplayTeachers(teachers)
  setDisplayTeacherClassrooms(classrooms)
  return { wondeTeachersTemp: wondeTeachersTemp }
}

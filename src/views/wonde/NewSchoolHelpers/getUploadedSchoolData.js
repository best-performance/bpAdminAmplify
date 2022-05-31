import { API } from 'aws-amplify'
import { updateAWSCredentials } from '../CommonHelpers/updateAWSCredentials'
import _ from 'lodash'

// Query to get all teachers in the selected school
// Despite its name
//     this is a query on table User
//     its also used to retrieve students in Table Users with userType = "Student"
const getTeachersBySchool = /* GraphQL */ `
  query GetTeachersBySchool($userType: String, $userSchoolID: ID, $limit: Int, $nextToken: String) {
    getTeachersBySchool(
      userType: { eq: $userType }
      userSchoolID: $userSchoolID
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        userType
        wondeID
        firstName
        lastName
        email
      }
      nextToken
    }
  }
`

// Query to get all students in the selected school for the current year
// This is a query on table SchoolStudent
const getSchoolStudentsByYear = /* GraphQL */ `
  query GetSchoolStudentsByYear($schoolYear: Int, $schoolID: ID, $limit: Int, $nextToken: String) {
    getSchoolStudentsByYear(
      schoolID: $schoolID
      schoolYear: { eq: $schoolYear }
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        student {
          wondeID
          birthDate
          firstName
          lastName
          id
        }
        yearLevel {
          yearCode
        }
      }
      nextToken
    }
  }
`

// Query to get all classrooms in the selected school
// This is a query on table Classroom
const getClassByYear = /* GraphQL */ `
  query GetClassByYear($schoolYear: Int, $schoolID: ID, $limit: Int, $nextToken: String) {
    getClassByYear(
      schoolID: $schoolID
      schoolYear: { eq: $schoolYear }
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        className
        wondeID
        teachers {
          items {
            email
          }
        }
        yearLevels {
          items {
            yearLevel {
              yearCode
            }
          }
        }
      }
      nextToken
    }
  }
`
// Query to get all classroomStudents (for a qiven classroomID)
// This is a query on table ClassroomStudent which is indexed on classroomID
// It has to be called for every classroomID
const getStudentsByClassroom = /* GraphQL */ `
  query GetStudentsByClassroom($classroomID: ID, $limit: Int, $nextToken: String) {
    getStudentsByClassroom(classroomID: $classroomID, limit: $limit, nextToken: $nextToken) {
      items {
        classroomID
        studentID
        classroom {
          wondeID
        }
        student {
          wondeID
        }
      }
      nextToken
    }
  }
`
// Query to get all classroomTeachers (for a qiven classroomID)
// This is a query on table ClassroomTeacher which is indexed on classroomID
// It has to be called for every classroomID
const getClassTeachers = /* GraphQL */ `
  query GetClassTeachers($classroomID: ID, $limit: Int, $nextToken: String) {
    getClassTeachers(classroomID: $classroomID, limit: $limit, nextToken: $nextToken) {
      items {
        classroomID
        email
        classroom {
          wondeID
        }
      }

      nextToken
    }
  }
`

export async function getUploadedSchoolData(schoolID, withAssignments) {
  await updateAWSCredentials() // uses the Cognito Identify pool role
  // read the classroom, students and User(teacher) tables from DynamoDB
  // must be all be empty arrays to make them iterable
  let classrooms = []
  let teachers = []
  let students = []
  let classroomTeachers = [] // only filled if withAssignments exists or true
  let classroomStudents = [] // only filled if withAssignments exists or true
  let studentUsers = [] // only filled if withAssignments exists or true
  let nextToken // used for paging all appsync queries
  let response // used for all appsyn query responses below

  try {
    // get the classrooms
    nextToken = null
    do {
      response = await API.graphql({
        query: getClassByYear,
        variables: { schoolYear: 2022, schoolID: schoolID, limit: 400, nextToken: nextToken },
        authMode: 'AMAZON_COGNITO_USER_POOLS',
      })
      response.data.getClassByYear.items.forEach((classroom) => {
        classrooms.push(_.cloneDeep(classroom))
      })
      nextToken = response.data.getClassByYear.nextToken
      //console.log('Classrooms nextToken', nextToken ? nextToken : 'Empty')
    } while (nextToken != null)
    console.log('Classrooms read from DynamoDB', classrooms)

    // get the students
    nextToken = null
    do {
      response = await API.graphql({
        query: getSchoolStudentsByYear,
        variables: { schoolYear: 2022, schoolID: schoolID, limit: 400, nextToken: nextToken },
        authMode: 'AMAZON_COGNITO_USER_POOLS',
      })
      response.data.getSchoolStudentsByYear.items.forEach((student) => {
        students.push(_.cloneDeep(student))
      })
      nextToken = response.data.getSchoolStudentsByYear.nextToken
      //console.log('Students nextToken', nextToken ? nextToken : 'Empty')
    } while (nextToken != null)
    console.log('Students read from DynamoDB', students)

    // get the teachers ()
    nextToken = null
    do {
      response = await API.graphql({
        query: getTeachersBySchool,
        variables: {
          userType: 'Educator',
          userSchoolID: schoolID,
          limit: 400,
          nextToken: nextToken,
        },
        authMode: 'AMAZON_COGNITO_USER_POOLS',
      })
      response.data.getTeachersBySchool.items.forEach((teacher) => {
        teachers.push(_.cloneDeep(teacher))
      })
      nextToken = response.data.getTeachersBySchool.nextToken
      //console.log('Teachers nextToken', nextToken ? nextToken : 'Empty')
    } while (nextToken != null)
    console.log('Teachers read from DynamoDB', teachers)
  } catch (err) {
    console.log(err)
    return false
  }
  // exit here unless we also need the classroomAsignments
  if (!withAssignments) {
    return {
      uploadedClassrooms: classrooms,
      uploadedTeachers: teachers,
      uploadedStudents: students,
    }
  }

  try {
    // get the all students in the User table for this school
    nextToken = null
    do {
      response = await API.graphql({
        query: getTeachersBySchool, // eventhough we are getting students!
        variables: {
          userType: 'Student',
          userSchoolID: schoolID,
          limit: 400,
          nextToken: nextToken,
        },
        authMode: 'AMAZON_COGNITO_USER_POOLS',
      })
      response.data.getTeachersBySchool.items.forEach((studentUser) => {
        studentUsers.push(_.cloneDeep(studentUser))
      })
      nextToken = response.data.getTeachersBySchool.nextToken
      console.log('StudentUsers nextToken', nextToken ? nextToken : 'Empty')
    } while (nextToken != null)

    console.log('StudentUsers read from DynamoDB', studentUsers)

    // get the all classroomStudents
    // For every ClassroomID, run appsyn query getStudentsByClassroom
    let studentPromises = classrooms.map(async (classroom) => {
      nextToken = null
      do {
        response = await API.graphql({
          query: getStudentsByClassroom,
          variables: {
            classroomID: classroom.id,
            limit: 400,
            nextToken: nextToken,
          },
          authMode: 'AMAZON_COGNITO_USER_POOLS',
        })
        //console.log('classroomStudent', classroom.id, response)
        response.data.getStudentsByClassroom.items.forEach((classroomStudent) => {
          classroomStudents.push({
            classroomWondeID: classroomStudent.classroom.wondeID,
            studentWondeID: classroomStudent.student.wondeID,
          })
        })
        nextToken = response.data.getStudentsByClassroom.nextToken
        //console.log('ClassroomStudents nextToken', nextToken ? nextToken : 'Empty')
      } while (nextToken != null)
    })
    await Promise.all(studentPromises)
    console.log('ClassroomStudents read from DynamoDB', classroomStudents)

    // get the all classroomTeachers
    // For every ClassroomID, run appsyn query getClassroomTeachers
    let teacherPromises = classrooms.map(async (classroom) => {
      nextToken = null
      do {
        response = await API.graphql({
          query: getClassTeachers,
          variables: {
            classroomID: classroom.id,
            limit: 400,
            nextToken: nextToken,
          },
          authMode: 'AMAZON_COGNITO_USER_POOLS',
        })
        //console.log('classroomTeachers', classroom.id, response)
        response.data.getClassTeachers.items.forEach((classroomTeacher) => {
          classroomTeachers.push({
            classroomWondeID: classroomTeacher.classroom.wondeID,
            email: classroomTeacher.email,
          })
        })
        nextToken = response.data.getClassTeachers.nextToken
        //console.log('ClassroomTeachers nextToken', nextToken ? nextToken : 'Empty')
      } while (nextToken != null)
    })
    await Promise.all(teacherPromises)

    console.log('ClassroomTeachers read from DynamoDB', classroomTeachers)

    return {
      uploadedClassrooms: classrooms,
      uploadedTeachers: teachers,
      uploadedStudents: students,
      uploadedStudentUsers: studentUsers,
      uploadedClassroomTeachers: classroomTeachers,
      uploadedClassroomStudents: classroomStudents,
    }
  } catch (err) {
    console.log(err)
    return false
  }
}

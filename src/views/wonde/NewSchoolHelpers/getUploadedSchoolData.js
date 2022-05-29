const { API } = require('aws-amplify')
const { updateAWSCredentials } = require('../CommonHelpers/updateAWSCredentials')

// Query to get all teachers in the selected school
// Despite its name this is a query on table User
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
  query GetStudentsByClassroom($classroomID: String, $limit: Int, $nextToken: String) {
    getStudentsByClassroom(classroomID: $classroomID, limit: $limit, nextToken: $nextToken) {
      items {
        classroomID
        studentID
      }
      nextToken
    }
  }
`
// Query to get all classroomTeachers (for a qiven classroomID)
// This is a query on table ClassroomTeacher which is indexed on classroomID
// It has to be called for every classroomID
const getClassTeachers = /* GraphQL */ `
  query GetClassTeachers($classroomID: String, $limit: Int, $nextToken: String) {
    getClassTeachers(classroomID: $classroomID, limit: $limit, nextToken: $nextToken) {
      items {
        classroomID
        email
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
      classrooms = [...classrooms, ...response.data.getClassByYear.items]
      nextToken = response.data.getClassByYear.nextToken
      console.log('Classrooms nextToken', nextToken ? nextToken : 'Empty')
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
      students = [...students, ...response.data.getSchoolStudentsByYear.items]
      nextToken = response.data.getSchoolStudentsByYear.nextToken
      console.log('Students nextToken', nextToken ? nextToken : 'Empty')
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
      teachers = [...teachers, ...response.data.getTeachersBySchool.items]
      nextToken = response.data.getTeachersBySchool.nextToken
      console.log('Teachers nextToken', nextToken ? nextToken : 'Empty')
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
      studentUsers = [...studentUsers, ...response.data.getTeachersBySchool.items]
      nextToken = response.data.getTeachersBySchool.nextToken
      console.log('StudentUsers nextToken', nextToken ? nextToken : 'Empty')
    } while (nextToken != null)
    console.log('StudentUsers read from DynamoDB', teachers)

    // get the all classroomStudents
    // For every ClassroomID, run appsyn query getStudentsByClassroom
    classrooms.forEach(async (classroom) => {
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
        classroomStudents = [...classroomStudents, ...response.data.getStudentsByClassroom.items]
        nextToken = response.data.getStudentsByClassroom.nextToken
        console.log('ClassroomStudents nextToken', nextToken ? nextToken : 'Empty')
      } while (nextToken != null)
    })

    console.log('ClassroomStudents read from DynamoDB', classroomStudents)

    // get the all classroomTeachers
    // For every ClassroomID, run appsyn query getClassroomTeachers
    classrooms.forEach(async (classroom) => {
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
        classroomTeachers = [...classroomTeachers, ...response.data.classroomTeachers.items]
        nextToken = response.data.classroomTeachers.nextToken
        console.log('ClassroomTeachers nextToken', nextToken ? nextToken : 'Empty')
      } while (nextToken != null)
    })

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

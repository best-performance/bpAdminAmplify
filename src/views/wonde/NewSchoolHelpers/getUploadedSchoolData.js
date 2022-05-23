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

export async function getUploadedSchoolData(schoolID) {
  await updateAWSCredentials() // uses the Cognito Identify pool role
  // read the tables from DynamoDB
  try {
    let response
    // get the classrooms
    let classrooms = [] // must be empty array to make it iterable
    let nextToken = null
    do {
      response = await API.graphql({
        query: getClassByYear,
        variables: { schoolYear: 2022, schoolID: schoolID, limit: 400, nextToken: nextToken },
        authMode: 'AMAZON_COGNITO_USER_POOLS',
      })
      classrooms = [...classrooms, ...response.data.getClassByYear.items]
      console.log('Classrooms already uploaded', classrooms)
      nextToken = response.data.getClassByYear.nextToken
      console.log('Classrooms nextToken', nextToken ? nextToken : 'Empty')
    } while (nextToken != null)

    // get the students
    let students = [] // must be empty array to make it iterable
    nextToken = null
    do {
      response = await API.graphql({
        query: getSchoolStudentsByYear,
        variables: { schoolYear: 2022, schoolID: schoolID, limit: 400, nextToken: nextToken },
        authMode: 'AMAZON_COGNITO_USER_POOLS',
      })
      students = [...students, ...response.data.getSchoolStudentsByYear.items]
      console.log('Students already uploaded', students)
      nextToken = response.data.getSchoolStudentsByYear.nextToken
      console.log('Students nextToken', nextToken ? nextToken : 'Empty')
    } while (nextToken != null)

    // get the teachers ()
    let teachers = []
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
      console.log('Teachers already uploaded', teachers)
      nextToken = response.data.getTeachersBySchool.nextToken
      console.log('Teachers nextToken', nextToken ? nextToken : 'Empty')
    } while (nextToken != null)

    return {
      uploadedClassrooms: classrooms,
      uploadedTeachers: teachers,
      uploadedStudents: students,
    }
  } catch (err) {
    console.log(err)
    return false
  }
}

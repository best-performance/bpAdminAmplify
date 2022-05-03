const { API } = require('aws-amplify')
const { updateAWSCredentials } = require('../CommonHelpers/updateAWSCredentials')

// Query to get all teachers in the selected school
// Despite its name this is a query on table User
const getTeachersBySchool = /* GraphQL */ `
  query GetTeachersBySchool($userType: String, $userSchoolID: ID) {
    getTeachersBySchool(userType: { eq: $userType }, userSchoolID: $userSchoolID) {
      items {
        userType
        wondeID
        firstName
        lastName
      }
    }
  }
`

// Query to get all students in the selected school for the current year
// This is a query on table SchoolStudent
const getSchoolStudentsByYear = /* GraphQL */ `
  query GetSchoolStudentsByYear($schoolYear: Int, $schoolID: ID) {
    getSchoolStudentsByYear(schoolID: $schoolID, schoolYear: { eq: $schoolYear }) {
      items {
        studentID
        student {
          wondeID
        }
      }
    }
  }
`

// Query to get all classrooms in the selected school
// This is a query on table Classroom
const getClassByYear = /* GraphQL */ `
  query GetClassByYear($schoolYear: Int, $schoolID: ID) {
    getClassByYear(schoolID: $schoolID, schoolYear: { eq: $schoolYear }) {
      items {
        className
        wondeID
      }
    }
  }
`

export async function getUploadedSchoolData(schoolID) {
  await updateAWSCredentials() // uses the Cognito Identify pool role
  try {
    // get the teachers
    let response = await API.graphql({
      query: getTeachersBySchool,
      variables: { userType: 'Educator', userSchoolID: schoolID },
      authMode: 'AMAZON_COGNITO_USER_POOLS',
    })
    console.log('Teachers', response)

    // get the students
    response = await API.graphql({
      query: getSchoolStudentsByYear,
      variables: { schoolYear: 2022, schoolID: schoolID },
      authMode: 'AMAZON_COGNITO_USER_POOLS',
    })
    console.log('Students', response)

    // get the classrooms
    response = await API.graphql({
      query: getClassByYear,
      variables: { schoolYear: 2022, schoolID: schoolID },
      authMode: 'AMAZON_COGNITO_USER_POOLS',
    })
    console.log('Classrooms', response)
  } catch (err) {
    console.log(err)
  }
}
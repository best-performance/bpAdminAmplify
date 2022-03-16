import React, { useContext, useState } from 'react'
import { CCard, CCardBody } from '@coreui/react'
import { Auth } from 'aws-amplify'
import loggedInContext from 'src/loggedInContext'
import notify from 'devextreme/ui/notify'
import { CRow, CContainer, CCol, CCardGroup } from '@coreui/react'
import TextBox from 'devextreme-react/text-box'
import Button from 'devextreme-react/button'
import ValidationSummary from 'devextreme-react/validation-summary'
import { Validator, RequiredRule, EmailRule, PatternRule } from 'devextreme-react/validator'
import { useHistory } from 'react-router-dom'

const Login = () => {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const history = useHistory()

  const { loggedIn } = useContext(loggedInContext)

  // Test function to create a new user
  async function handleUserCreation() {
    if (!email || !nickname || !schoolName) {
      notify('All files are required', 'error', 3000)
    }

    try {
      await Auth.signUp({
        username,
        password: `${username}P${new Date().getFullYear()}!`,
        attributes: {
          email,
          nickname,
          'custom:schoolName': schoolName, // custom attribute, not standard
        },
      })
      notify('👋 The user has been registered', 'success', 3000)
      history.push('/users/manageUsers')
    } catch (error) {
      notify(`${error.message}`, 'error', 3000)
      console.log(error)
      handleResetForm()
    }
  }

  function handleResetForm() {
    setEmail('')
    setUsername('')
    setNickname('')
    setSchoolName('')
  }
  // testing
  if (!loggedIn.username) {
    return (
      <CContainer>
        <CRow>Please login first</CRow>
      </CContainer>
    )
  }

  return (
    <div className="bg-light min-vh-100 d-flex flex-row">
      <CContainer>
        <CRow>
          <CCol style={{ height: '100px' }}></CCol>
        </CRow>
        <CRow className="justify-content-center">
          <CCol md={8}>
            <CCardGroup>
              <CCard>
                <CCardBody>
                  <form>
                    <div className="dx-fieldset">
                      <div className="dx-fieldset-header">User info</div>

                      <div className="dx-field">
                        <div className="dx-field-label">Username</div>
                        <div className="dx-field-value">
                          <TextBox
                            value={username}
                            onValueChange={(e) => {
                              setUsername(e)
                            }}
                          >
                            <Validator>
                              <RequiredRule message="Username is required" />
                              <PatternRule
                                message="Please enter a valid user name with no spaces or special characters."
                                pattern={/^(?=.{4,20}$)(?:[a-zA-Z\d]+(?:(?:\.|-|_)[a-zA-Z\d])*)+$/}
                              />
                            </Validator>
                          </TextBox>
                        </div>
                      </div>

                      <div className="dx-field">
                        <div className="dx-field-label">Email</div>
                        <div className="dx-field-value">
                          <TextBox
                            value={email}
                            onValueChange={(e) => {
                              setEmail(e)
                            }}
                          >
                            <Validator>
                              <RequiredRule message="Email is required" />
                              <EmailRule message="Email is invalid" />
                            </Validator>
                          </TextBox>
                        </div>
                      </div>
                    </div>

                    <div className="dx-fieldset">
                      <div className="dx-fieldset-header">Personal Data</div>

                      <div className="dx-field">
                        <div className="dx-field-label">Nickname</div>
                        <div className="dx-field-value">
                          <TextBox
                            value={nickname}
                            onValueChange={(e) => {
                              setNickname(e)
                            }}
                          >
                            <Validator>
                              <RequiredRule message="Nickname is required" />
                            </Validator>
                          </TextBox>
                        </div>
                      </div>

                      <div className="dx-field">
                        <div className="dx-field-label">School Name</div>
                        <div className="dx-field-value">
                          <TextBox
                            value={schoolName}
                            onValueChange={(e) => {
                              setSchoolName(e)
                            }}
                          >
                            <Validator>
                              <RequiredRule message="School Name is required" />
                            </Validator>
                          </TextBox>
                        </div>
                      </div>
                    </div>

                    <div className="dx-fieldset">
                      <ValidationSummary
                        id="summary"
                        style={{ marginTop: '15px', marginBottom: '15px' }}
                      ></ValidationSummary>
                      <Button
                        id="button"
                        text="Register"
                        type="success"
                        onClick={handleUserCreation}
                      />
                      <Button
                        id="button"
                        text="Reset Form"
                        type="success"
                        useSubmitBehavior={true}
                        onClick={handleResetForm}
                        style={{ marginLeft: '20px' }}
                      />
                    </div>
                  </form>
                </CCardBody>
              </CCard>
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login

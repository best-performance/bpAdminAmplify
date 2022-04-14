import React, { useRef } from 'react'
import { Popup } from 'devextreme-react/popup'
import { Form } from 'devextreme-react'
import PropTypes from 'prop-types'
import {
  ButtonItem,
  Label,
  PatternRule,
  RequiredRule,
  SimpleItem,
  StringLengthRule,
} from 'devextreme-react/form'

// This components presents a form to reset the password of a user, it uses UsersHelper - resetFormPassword
function ResetPasswordPopUp({
  setShowResetPasswordPopUp,
  showResetPasswordPopUp,
  resetFormPassword,
  selectedUsername,
  loadUsers,
}) {
  const buttonOptions = {
    text: 'Reset Password',
    type: 'success',
    useSubmitBehavior: true,
  }

  const resetPasswordFormData = useRef({
    Username: selectedUsername,
    Password: '',
    UserPoolId: `${process.env.REACT_APP_USER_POOL_ID}`,
    Permanent: true,
  })

  function onResetPasswordHidding() {
    setShowResetPasswordPopUp(null)
    resetPasswordFormData.current = {
      Username: selectedUsername,
      Password: '',
      UserPoolId: `${process.env.REACT_APP_USER_POOL_ID}`,
      Permanent: true,
    }
  }

  async function resetSubmit(event) {
    event.preventDefault()
    await resetFormPassword(resetPasswordFormData)
    loadUsers()
  }

  return (
    <Popup
      visible={showResetPasswordPopUp}
      onHiding={onResetPasswordHidding}
      dragEnabled={false}
      closeOnOutsideClick={true}
      showTitle={true}
      title="Reset user password"
      width={300}
      height={210}
    >
      <form action="submit" onSubmit={resetSubmit}>
        <Form formData={resetPasswordFormData.current}>
          <SimpleItem dataField={'Password'}>
            <Label text="Password" />
            <RequiredRule message="Password cannot be blank" />
            <StringLengthRule min={8} message="Password must be minimum 8 characters" />
            <PatternRule
              pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])"
              message="Password must contain Uppercase & Lowercase characters & at least 1 number"
            />
          </SimpleItem>
          <ButtonItem horizontalAlignment="center" buttonOptions={buttonOptions} />
        </Form>
      </form>
    </Popup>
  )
}
export default ResetPasswordPopUp

ResetPasswordPopUp.propTypes = {
  setShowResetPasswordPopUp: PropTypes.func.isRequired,
  showResetPasswordPopUp: PropTypes.bool.isRequired,
  resetFormPassword: PropTypes.func.isRequired,
  selectedUsername: PropTypes.string.isRequired,
  loadUsers: PropTypes.func.isRequired,
}

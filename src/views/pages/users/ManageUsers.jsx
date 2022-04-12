import React, { useEffect, useState } from 'react'

import {
  Column,
  Editing,
  Export,
  FilterRow,
  LoadPanel,
  Lookup,
  RequiredRule,
  Scrolling,
  Selection,
  Texts,
  Sorting,
  Paging,
  Pager,
  Button,
  DataGrid,
} from 'devextreme-react/data-grid'
import SpecialAttributesPopUp from '../../../components/users/SpecialAttributesPopUp'
import ResetPasswordPopUp from '../../../components/users/ResetPasswordPopUp'
import { loadUsersFromCognito, resetPassword, disableUser } from './UsersHelpers/UsersHelper.js'

/**
 * This page shows all the users in the cognito pool and allows to manage them.
 * Children components: ResetPasswordPopUp, SpecialAttributesPopUp
 * Helpers: UsersHelper
 * @returns a component to list all users in the app and manage them (see special attributes, disable users, reset passwords)
 */
function ManageUsers() {
  const [users, setUsers] = useState([])
  const [specialAttributes, setSpecialAttributes] = useState(null)
  const [showResetPasswordPopUp, setShowResetPasswordPopUp] = useState(null)
  const [selectedUsername, setSelectedUsername] = useState()

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    let users = await loadUsersFromCognito()
    setUsers(users)
  }

  return (
    <div>
      <h4>Manage Users</h4>
      <DataGrid
        showBorders={true}
        hoverStateEnabled={true}
        allowColumnReordering={true}
        columnAutoWidth={true}
        dataSource={users}
      >
        <Sorting mode="multiple" />
        <LoadPanel enabled={true} text="Retrieving students..." width={400} />
        <Scrolling rowRenderingMode="virtual"></Scrolling>
        <Export enabled={true} />
        <Paging defaultPageSize={150} />
        <Pager
          visible={true}
          allowedPageSizes={true}
          showPageSizeSelector={true}
          showInfo={true}
          showNavigationButtons={true}
        />
        <Column caption="Username" dataField="Username" />
        <Column caption="Creation date" dataField="UserCreateDate" />
        <Column caption="Last modified date" dataField="UserLastModifiedDate" />
        <Column caption="Enabled" dataField="Enabled" />
        <Column caption="Status" dataField="UserStatus" />
        <Column type="buttons" width="10%" alignment="center" caption="Attributes">
          <Button
            hint="Get attributes of the user"
            icon="bulletlist"
            onClick={(e) => {
              setSpecialAttributes(e.row.data.Attributes)
            }}
            name="Get User Attributes"
          />
        </Column>
        <Column
          type="buttons"
          width="10%"
          alignment="center"
          caption="Disable User"
          name="Disable User"
        >
          <Button
            hint="Disable this user"
            icon="clear"
            onClick={async (e) => {
              await disableUser(e.row.data.Username, e.row.data.Enabled)
              await loadUsers()
            }}
          />
        </Column>
        <Column
          type="buttons"
          width="10%"
          alignment="center"
          caption="Reset Password"
          name="Reset User Password"
        >
          <Button
            hint="Reset their password"
            icon="key"
            onClick={(e) => {
              setShowResetPasswordPopUp(true)
              setSelectedUsername(e.row.data.Username)
            }}
          />
        </Column>
      </DataGrid>
      {specialAttributes && (
        <SpecialAttributesPopUp
          setSpecialAttributes={setSpecialAttributes}
          specialAttributes={specialAttributes}
        />
      )}
      {showResetPasswordPopUp && (
        <ResetPasswordPopUp
          setShowResetPasswordPopUp={setShowResetPasswordPopUp}
          showResetPasswordPopUp={showResetPasswordPopUp}
          resetFormPassword={resetPassword}
          selectedUsername={selectedUsername}
          loadUsers={loadUsers}
        />
      )}
    </div>
  )
}
export default ManageUsers

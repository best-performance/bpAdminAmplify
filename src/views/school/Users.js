import React from 'react'
import { CCard, CContainer, CRow } from '@coreui/react'
import { DataGrid, Column, FilterRow, SearchPanel, Button } from 'devextreme-react/data-grid'
import { userdata } from './userdata'

function Users() {
  function deactivateUser() {
    console.log('Deactivating user from database...')
  }
  return (
    <CContainer>
      <CRow>
        <CCard>
          <DataGrid dataSource={userdata} columnAutoWidth={true}>
            <Column dataField="FirstName"></Column>
            <Column dataField="LastName"></Column>
            <Column dataField="School"></Column>
            <Column type="buttons" width={50}>
              <Button
                hint="Deactivate/Delete"
                icon="clearformat"
                visible={true}
                onClick={deactivateUser}
              />
            </Column>
            <FilterRow visible={true} />
            <SearchPanel visible={true} />
          </DataGrid>
        </CCard>
      </CRow>
    </CContainer>
  )
}
export default Users

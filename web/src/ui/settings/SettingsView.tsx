// gomuks - A Matrix client written in Go.
// Copyright (C) 2024 Tulir Asokan
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
import { use, useCallback } from "react"
import { RoomStateStore } from "@/api/statestore"
import {
	PreferenceContext,
	PreferenceValueType,
	Preferences,
} from "@/api/types/preferences"
import ClientContext from "../ClientContext.ts"
import CustomCSSInput from "./CustomCSSInput.tsx"
import KeyExportView from "./KeyExportView.tsx"
import MiscButtons from "./MiscButtons.tsx"
import RoomSettings from "./RoomSettings.tsx"
import SettingsDeck from "./SettingsDeck.tsx"
import "./SettingsView.css"

export type SetPrefFunc =
	(context: PreferenceContext, key: keyof Preferences, value: PreferenceValueType | undefined) => void

interface SettingsViewProps {
	room?: RoomStateStore
}

const SettingsView = ({ room }: SettingsViewProps) => {
	const client = use(ClientContext)!
	const setPref = useCallback((
		context: PreferenceContext, key: keyof Preferences, value: PreferenceValueType | undefined,
	) => {
		if (context === PreferenceContext.Account) {
			client.rpc.setAccountData("fi.mau.gomuks.preferences", {
				...client.store.serverPreferenceCache,
				[key]: value,
			})
		} else if (context === PreferenceContext.Device) {
			if (value === undefined) {
				delete client.store.localPreferenceCache[key]
			} else {
				(client.store.localPreferenceCache[key] as PreferenceValueType) = value
			}
			if (key === "web_push") {
				client.registerWebPush()
			}
		} else if (context === PreferenceContext.RoomAccount && room) {
			client.rpc.setAccountData("fi.mau.gomuks.preferences", {
				...room.serverPreferenceCache,
				[key]: value,
			}, room.roomID)
		} else if (context === PreferenceContext.RoomDevice && room) {
			if (value === undefined) {
				delete room.localPreferenceCache[key]
			} else {
				(room.localPreferenceCache[key] as PreferenceValueType) = value
			}
		}
	}, [client, room])
	return <>
		<h2>Settings</h2>
		{room && <RoomSettings room={room} />}
		<SettingsDeck setPref={setPref} room={room} />
		<hr/>
		<CustomCSSInput setPref={setPref} room={room} />
		<hr/>
		<KeyExportView room={room} />
		<hr/>
		<MiscButtons />
	</>
}

export default SettingsView

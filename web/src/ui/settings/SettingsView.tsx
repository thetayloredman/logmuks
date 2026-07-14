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
import { getRoomAvatarThumbnailURL, getRoomAvatarURL } from "@/api/media.ts"
import { RoomStateStore } from "@/api/statestore"
import { RoomType } from "@/api/types"
import {
	PreferenceContext,
	PreferenceValueType,
	Preferences,
	preferences,
} from "@/api/types/preferences"
import { useEventAsState } from "@/util/eventdispatcher.ts"
import ClientContext from "../ClientContext.ts"
import { LightboxContext, ModalCloseContext, ModalContext, modals } from "../modal"
import CustomCSSInput from "./CustomCSSInput.tsx"
import KeyExportView from "./KeyExportView.tsx"
import SettingsDeck from "./SettingsDeck.tsx"
import "./SettingsView.css"

export type SetPrefFunc =
	(context: PreferenceContext, key: keyof Preferences, value: PreferenceValueType | undefined) => void

interface SettingsViewProps {
	room?: RoomStateStore
}

const SettingsView = ({ room }: SettingsViewProps) => {
	const roomMeta = useEventAsState(room?.meta)
	const client = use(ClientContext)!
	const closeModal = use(ModalCloseContext)
	const openModal = use(ModalContext)
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
	const onClickLogout = () => {
		if (window.confirm("Really log out and delete all local data?")) {
			client.logout().then(
				() => console.info("Successfully logged out"),
				err => window.alert(`Failed to log out: ${err}`),
			)
		}
	}
	const onClickLeave = () => {
		if (room && window.confirm(`Really leave ${room.meta.current.name}?`)) {
			client.rpc.leaveRoom(room.roomID).then(
				() => {
					console.info("Successfully left", room.roomID)
					closeModal()
				},
				err => window.alert(`Failed to leave room: ${err}`),
			)
		}
	}
	const openDevtools = () => {
		if (room) {
			openModal(modals.roomStateExplorer(room))
		}
	}
	const onClickOpenCSSApp = () => {
		client.rpc.requestOpenIDToken().then(
			resp => window.open(
				`https://css.gomuks.app/login?token=${resp.access_token}&server_name=${resp.matrix_server_name}`,
				"_blank",
				"noreferrer noopener",
			),
			err => window.alert(`Failed to request OpenID token: ${err}`),
		)
	}
	const previousRoomID = roomMeta?.creation_content?.predecessor?.room_id
	const openPredecessorRoom = () => {
		window.mainScreenContext.setActiveRoom(previousRoomID!)
		closeModal()
	}
	return <>
		<h2>Settings</h2>
		{roomMeta && <div className="room-details">
			<img
				className="avatar large"
				loading="lazy"
				src={getRoomAvatarThumbnailURL(roomMeta)}
				data-full-src={getRoomAvatarURL(roomMeta)}
				onClick={use(LightboxContext)}
				alt=""
			/>
			<div>
				{roomMeta.name && <div className="room-name">{roomMeta.name}</div>}
				<code>{room!.roomID}</code>
				<div>{roomMeta.topic}</div>
				<div className="room-buttons">
					<button className="leave-room" onClick={onClickLeave}>Leave room</button>
					<button className="devtools" onClick={openDevtools}>Open devtools</button>
					<select onChange={evt => {
						window.activeRoomContext?.setForceViewType(evt.target.value as RoomType)
						closeModal()
					}} defaultValue="__null__">
						{preferences.room_view_type.allowedValues!.map((val, i) =>
							<option key={i} value={val ?? "__null__"} disabled={i === 0}>
								{i === 0 ? "Override view" : preferences.room_view_type.valueLabels![i]}
							</option>)}
					</select>
					{previousRoomID &&
						<button className="previous-room" onClick={openPredecessorRoom}>
							Open Predecessor Room
						</button>}
				</div>
			</div>
		</div>}
		<SettingsDeck setPref={setPref} room={room} />
		<hr/>
		<CustomCSSInput setPref={setPref} room={room} />
		<hr/>
		<KeyExportView room={room} />
		<hr/>
		<div className="misc-buttons">
			<button onClick={onClickOpenCSSApp}>Sign into css.gomuks.app</button>
			{window.Notification && !window.gomuksAndroid && <button onClick={client.requestNotificationPermission}>
				Request notification permission
			</button>}
			{!window.gomuksAndroid &&
				<button onClick={client.registerURIHandler}>Register <code>matrix:</code> URI handler</button>
			}
			<button className="logout" onClick={onClickLogout}>Logout</button>
		</div>
	</>
}

export default SettingsView

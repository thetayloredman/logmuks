// gomuks - A Matrix client written in Go.
// Copyright (C) 2026 Tulir Asokan
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
import { use, useState } from "react"
import { MoonLoader } from "react-spinners"
import { getRoomAvatarThumbnailURL, getRoomAvatarURL } from "@/api/media.ts"
import { RoomStateStore, useRoomState } from "@/api/statestore"
import { RoomType } from "@/api/types"
import { preferences } from "@/api/types/preferences"
import { useEventAsState } from "@/util/eventdispatcher.ts"
import { getEventLevel } from "@/util/powerlevel.ts"
import ClientContext from "../ClientContext.ts"
import { getPowerLevels } from "../menu/util.ts"
import { LightboxContext, ModalCloseContext, ModalContext, modals } from "../modal"

interface RoomSettingsProps {
	room: RoomStateStore
}

const RoomSettings = ({ room }: RoomSettingsProps) => {
	const roomMeta = useEventAsState(room?.meta)
	const client = use(ClientContext)!
	const closeModal = use(ModalCloseContext)
	const openModal = use(ModalContext)

	useRoomState(room, "m.room.power_levels")
	const [pls, ownPL] = getPowerLevels(room, client)
	const canChangeName = ownPL >= getEventLevel(pls, "m.room.name", true)
	const canChangeTopic = ownPL >= getEventLevel(pls, "m.room.topic", true)

	const [newName, setNewName] = useState<string>()
	const [newTopic, setNewTopic] = useState<string>()
	const [loading, setLoading] = useState(false)

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
	const previousRoomID = roomMeta?.creation_content?.predecessor?.room_id
	const openPredecessorRoom = () => {
		window.mainScreenContext.setActiveRoom(previousRoomID!)
		closeModal()
	}
	const cancelGeneralEdit = () => {
		setNewName(undefined)
		setNewTopic(undefined)
	}
	const saveGeneralInfo = () => {
		if (loading) {
			return
		}
		const promises = []
		if (newName !== undefined && newName !== roomMeta.name) {
			promises.push(client.rpc.setState(room.roomID, "m.room.name", "", { name: newName }))
		}
		if (newTopic !== undefined && newTopic !== roomMeta.topic) {
			promises.push(client.rpc.setState(room.roomID, "m.room.topic", "", { topic: newTopic }))
		}
		if (promises.length) {
			setLoading(true)
			Promise.all(promises).then(
				() => {
					setNewName(undefined)
					setNewTopic(undefined)
				},
				err => {
					console.error("Failed to save room info", err)
					window.alert(`Failed to save room info: ${err}`)
				},
			).finally(() => setLoading(false))
		}
	}
	return <div className="room-details">
		<div className="general-info">
			<img
				className="avatar large"
				loading="lazy"
				src={getRoomAvatarThumbnailURL(roomMeta)}
				data-full-src={getRoomAvatarURL(roomMeta)}
				onClick={use(LightboxContext)}
				alt=""
			/>
			<code>{room.roomID}</code>
			<input
				className="room-name-input"
				type="text"
				placeholder="Room name"
				value={newName ?? roomMeta.name ?? ""}
				onChange={evt => setNewName(evt.target.value)}
				disabled={!canChangeName}
			/>
			<textarea
				className="room-topic-input"
				placeholder="Room topic"
				value={newTopic ?? roomMeta.topic ?? ""}
				onChange={evt => setNewTopic(evt.target.value)}
				disabled={!canChangeTopic}
			/>
			<div className="buttons">
				<button className="cancel-button" disabled={!newName && !newTopic} onClick={cancelGeneralEdit}>
					Cancel
				</button>
				<button className="save-button" disabled={!newName && !newTopic} onClick={saveGeneralInfo}>
					{loading ? <MoonLoader size={16} /> : "Save"}
				</button>
			</div>
		</div>
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
}

export default RoomSettings

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
import { use } from "react"
import { getRoomAvatarThumbnailURL, getRoomAvatarURL } from "@/api/media.ts"
import { RoomStateStore } from "@/api/statestore"
import { RoomType } from "@/api/types"
import { preferences } from "@/api/types/preferences"
import { useEventAsState } from "@/util/eventdispatcher.ts"
import ClientContext from "../ClientContext.ts"
import { LightboxContext, ModalCloseContext, ModalContext, modals } from "../modal"

interface RoomSettingsProps {
	room: RoomStateStore
}

const RoomSettings = ({ room }: RoomSettingsProps) => {
	const roomMeta = useEventAsState(room?.meta)
	const client = use(ClientContext)!
	const closeModal = use(ModalCloseContext)
	const openModal = use(ModalContext)
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
	return <div className="room-details">
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
	</div>
}

export default RoomSettings

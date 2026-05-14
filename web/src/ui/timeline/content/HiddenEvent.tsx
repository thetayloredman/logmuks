// gomuks - A Matrix client written in Go.
// Copyright (C) 2024 Tulir Asokan
// Copyright (C) 2026 Logan Devine
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
import { MouseEvent } from "react"
import { EventID } from "../../../api/types/mxtypes.ts"
import { useRoomContext } from "../../roomview/roomcontext.ts"
import { jumpToEventInView } from "../../util/jumpToEvent.tsx"
import EventContentProps from "./props.ts"

const HiddenEvent = ({ event }: EventContentProps) => {
	const roomCtx = useRoomContext()
	const jumpToOnClick = (event_id: EventID) => (evt: MouseEvent<HTMLAnchorElement>) => {
		evt.preventDefault()
		jumpToEventInView(roomCtx, event_id, evt.currentTarget.closest(".timeline-list"))
	}
	const makeEventURI = (e: EventID) =>
		`matrix:roomid/${encodeURIComponent(roomCtx.store.roomID.slice(1))}/e/${encodeURIComponent(e.slice(1))}`

	const renderEventLink = (event_id: EventID) => (
		<a key={event_id} href={makeEventURI(event_id)} onClick={jumpToOnClick(event_id)}>
			{event_id}
		</a>
	)

	// check for a field within content so that redacted reactions/redactions don't throw
	if (event.type === "m.room.redaction" && event.content.redacts) {
		return <code>m.room.redaction {renderEventLink(event.content.redacts)}</code>
	} else if (event.type === "m.reaction" && event.content["m.relates_to"]) {
		return (
			<code>
				m.reaction event_id={renderEventLink(event.content["m.relates_to"].event_id)}, key=
				{event.content["m.relates_to"].key}
			</code>
		)
	} else if (event.type === "m.room.message" && event.content["m.relates_to"]?.rel_type === "m.replace") {
		return <code>m.room.message replaces={renderEventLink(event.content["m.relates_to"].event_id)}</code>
	} else {
		return <code>{`${event.type}`}</code>
	}
}

export default HiddenEvent

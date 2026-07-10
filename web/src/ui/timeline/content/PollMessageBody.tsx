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
import React, { use, useEffect, useMemo, useState } from "react"
import { MoonLoader } from "react-spinners"
import { MemDBEvent, PollResponseEventContent, PollStartEventContent, UserID } from "@/api/types"
import { getEventLevel } from "@/util/powerlevel.ts"
import { ensureString, ensureStringArray, getLegacyMSC1767Text } from "@/util/validation.ts"
import ClientContext from "../../ClientContext.ts"
import { getPowerLevels } from "../../menu/util.ts"
import EventContentProps from "./props.ts"

const votesLoadingKey = "__votes__" + Math.random().toString(36).slice(2, 10)

const PollMessageBody = ({ event, room }: EventContentProps) => {
	const client = use(ClientContext)!

	const content = event.content as PollStartEventContent
	const pollStart = content["org.matrix.msc3381.poll.start"] ?? {}

	const [votes, setVotes] = useState<Record<UserID, string[]> | null>(null)
	const [pollEndTS, setPollEndTS] = useState<number>(0)
	const [loading, setLoading] = useState<null | string>(null)

	useEffect(() => pollEndTS > 0 ? undefined : room.newTimelineEventSub.listen(evt => {
		if (evt === null) {
			setVotes(null)
			return
		}
		if (pollEndTS > 0 || evt.relation_type !== "m.reference" || evt.relates_to !== event.event_id) {
			return
		}
		if (evt.type === "org.matrix.msc3381.poll.end") {
			setPollEndTS(evt.timestamp)
		} else if (evt.type === "org.matrix.msc3381.poll.response") {
			setVotes(oldVotes => {
				if (oldVotes === null) {
					return null
				}
				const content = evt.content as PollResponseEventContent
				return {
					...oldVotes,
					[evt.sender]: ensureStringArray(content?.["org.matrix.msc3381.poll.response"]?.answers),
				}
			})
		}
	}), [room, event.event_id, pollEndTS])

	const votesByAnswer = useMemo(() => {
		if (!votes) {
			return null
		}
		const result: Record<string, UserID[]> = {}
		for (const [userID, answerIDs] of Object.entries(votes)) {
			for (const answerID of answerIDs) {
				if (!result[answerID]) {
					result[answerID] = []
				}
				result[answerID].push(userID)
			}
		}
		return result
	}, [votes])
	const totalVotes = useMemo(() => {
		if (!votes) {
			return null
		}
		return Object.values(votes).reduce((sum, arr) => sum + arr.length, 0)
	}, [votes])

	const loadVotesDirect = async () => {
		let res: MemDBEvent[]
		try {
			res = await client.getRelatedEvents(room, event.event_id, "m.reference")
		} catch (err) {
			console.error("Failed to load poll votes:", err)
			window.alert(`Failed to load poll votes: ${err}`)
			return null
		}
		const pollEndTS = res.find(evt => evt.type === "org.matrix.msc3381.poll.end")?.timestamp ?? 0
		res.sort((a, b) => a.timestamp - b.timestamp)
		const votes = {} as Record<UserID, string[]>
		for (const evt of res) {
			if (
				evt.type !== "org.matrix.msc3381.poll.response"
				|| (pollEndTS > 0 && evt.timestamp > pollEndTS)
			) {
				continue
			}
			const content = evt.content as PollResponseEventContent
			let voteList = ensureStringArray(content?.["org.matrix.msc3381.poll.response"]?.answers)
			if (pollStart.max_selections > 0 && voteList.length > pollStart.max_selections) {
				voteList = voteList.slice(0, pollStart.max_selections)
			}
			votes[evt.sender] = voteList
		}
		setPollEndTS(pollEndTS)
		setVotes(votes)
		return votes
	}
	const clickLoadVotes = () => {
		setLoading(votesLoadingKey)
		loadVotesDirect().finally(() => setLoading(null))
	}
	const voteDirect = async (answerID: string, checked: boolean) => {
		let oldVotes = votes
		if (oldVotes === null) {
			oldVotes = await loadVotesDirect()
			if (oldVotes === null) {
				return
			}
		}
		let ownVote = oldVotes[client.userID] ?? []
		if (ownVote.includes(answerID) === checked) {
			return
		}
		if (checked) {
			ownVote = [...ownVote]
			ownVote.push(answerID)
			if (pollStart.max_selections > 0 && ownVote.length > pollStart.max_selections) {
				ownVote.splice(0, ownVote.length - pollStart.max_selections)
			}
		} else {
			ownVote = ownVote.filter(id => id !== answerID)
		}
		const answerContent: PollResponseEventContent = {
			"m.relates_to": {
				event_id: event.event_id,
				rel_type: "m.reference",
			},
			"org.matrix.msc3381.poll.response": {
				answers: ownVote,
			},
		}
		try {
			await client.rpc.sendEvent(room.roomID, "org.matrix.msc3381.poll.response", answerContent)
			setVotes(oldVotes => ({
				...oldVotes,
				[client.userID]: ownVote,
			}))
		} catch (err) {
			console.error("Failed to send poll response:", err)
			window.alert(`Failed to send poll response: ${err}`)
		}
	}
	const clickVote = (answerID: string, evt: React.ChangeEvent<HTMLInputElement>) => {
		setLoading(answerID)
		voteDirect(answerID, evt.currentTarget.checked).finally(() => setLoading(null))
	}
	const [pls, ownPL] = getPowerLevels(room, client)
	const canVote = ownPL >= getEventLevel(pls, "org.matrix.msc3381.poll.response", false)

	const ownVote = votes?.[client.userID] ?? []

	return <div className="poll-body">
		<div className="poll-question">
			{getLegacyMSC1767Text(pollStart.question) || "No question provided"}
			{pollEndTS > 0 ? " (closed)" : !canVote ? " (no vote permissions)" : ""}
		</div>

		<div className="poll-answers">
			{pollStart.answers?.map(answer => {
				const answerID = ensureString(answer.id)
				if (!answerID) {
					return null
				}
				const voteCount = votesByAnswer?.[answerID]?.length ?? 0
				const voteShare = totalVotes ? voteCount / totalVotes : 0
				// TODO proper UI for viewing who voted
				const voters = votesByAnswer?.[answerID]?.join(", ")
				return <label
					key={answerID}
					className={`poll-answer ${pollEndTS > 0 || !canVote ? "cant-vote" : "can-vote"}`}
					title={voters}
				>
					{loading === answerID ?  <MoonLoader className="poll-answer-checkbox" size={16} /> : <input
						type="checkbox"
						className="poll-answer-checkbox"
						checked={ownVote.includes(answerID)}
						onChange={e => clickVote(answerID, e)}
						disabled={loading !== null || pollEndTS > 0 || !canVote}
					/>}
					<div className="answer-text">
						{getLegacyMSC1767Text(answer)}
					</div>
					{votesByAnswer ? <>
						<div className="vote-bar">
							<div className="bar-filler" style={{ width: `${Math.round(voteShare * 100)}%` }} />
						</div>
						<div className="vote-count">
							{voteCount} vote{voteCount === 1 ? "" : "s"}
						</div>
					</> : null}
				</label>
			})}
		</div>

		{votes === null && <button
			className="load-votes-button"
			disabled={loading !== null}
			onClick={clickLoadVotes}
		>Load votes</button>}
	</div>
}

export default PollMessageBody

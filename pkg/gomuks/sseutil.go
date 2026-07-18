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

package gomuks

import (
	"encoding/json"
	"iter"
	"net/http"
	"slices"
)

type sseWriter struct {
	rc *http.ResponseController
	w  http.ResponseWriter
	j  *json.Encoder
}

func newSSEWriter(w http.ResponseWriter) *sseWriter {
	_, ok := w.(http.Flusher)
	if !ok {
		return nil
	}
	rc := http.NewResponseController(w)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	return &sseWriter{
		rc: rc,
		w:  w,
		j:  json.NewEncoder(w),
	}
}

var pingBytes = []byte(":\n\n")
var dataBytes = []byte("data:")

func (w *sseWriter) write(cmd *BufferedEvent) (err error) {
	_, err = w.w.Write(dataBytes)
	if err != nil {
		return
	}
	err = w.j.Encode(cmd)
	if err != nil {
		return
	}
	_, err = w.w.Write(newlineBytes)
	return
}

func (w *sseWriter) ping() error {
	_, err := w.w.Write(pingBytes)
	if err != nil {
		return err
	}
	return w.rc.Flush()
}

func (w *sseWriter) writeAndFlush(cmd *BufferedEvent, extra iter.Seq[*BufferedEvent]) (err error) {
	if cmd != nil {
		err = w.write(cmd)
		if err != nil {
			return
		}
	}
	if extra != nil {
		err = w.writeSeq(extra)
		if err != nil {
			return
		}
	}
	return w.rc.Flush()
}

func (w *sseWriter) writeSeq(cmds iter.Seq[*BufferedEvent]) (err error) {
	if cmds == nil {
		return
	}
	for item := range cmds {
		err = w.write(item)
		if err != nil {
			return
		}
	}
	return
}

func (w *sseWriter) writeMany(cmds ...*BufferedEvent) (err error) {
	return w.writeSeq(slices.Values(cmds))
}

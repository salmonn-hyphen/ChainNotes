// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ChainNotes {
    struct Note {
        uint id;
        string content;
        uint timestamp;
        address owner;
        bool isDeleted;
    }

    uint public noteCount = 0;
    mapping(uint => Note) public notes;
    mapping(address => uint[]) public userNotes;

    event NoteCreated(uint id, address owner, string content, uint timestamp);
    event NoteUpdated(uint id, string newContent, uint timestamp);
    event NoteDeleted(uint id);

    modifier onlyOwner(uint _id) {
        require(notes[_id].owner == msg.sender, "Not the note owner");
        require(!notes[_id].isDeleted, "Note is deleted");
        _;
    }

    function createNote(string memory _content) public {
        noteCount++;
        notes[noteCount] = Note(noteCount, _content, block.timestamp, msg.sender, false);
        userNotes[msg.sender].push(noteCount);
        emit NoteCreated(noteCount, msg.sender, _content, block.timestamp);
    }

    function updateNote(uint _id, string memory _newContent) public onlyOwner(_id) {
        notes[_id].content = _newContent;
        notes[_id].timestamp = block.timestamp;
        emit NoteUpdated(_id, _newContent, block.timestamp);
    }

    function deleteNote(uint _id) public onlyOwner(_id) {
        notes[_id].isDeleted = true;
        emit NoteDeleted(_id);
    }

    function getUserNotes() public view returns (Note[] memory) {
        uint[] memory userNoteIds = userNotes[msg.sender];
        uint activeCount = 0;

        // Count active notes to size the array correctly
        for (uint i = 0; i < userNoteIds.length; i++) {
            if (!notes[userNoteIds[i]].isDeleted) {
                activeCount++;
            }
        }

        Note[] memory result = new Note[](activeCount);
        uint currentIndex = 0;

        // Populate the array with active notes
        for (uint i = 0; i < userNoteIds.length; i++) {
            if (!notes[userNoteIds[i]].isDeleted) {
                result[currentIndex] = notes[userNoteIds[i]];
                currentIndex++;
            }
        }

        return result;
    }
}

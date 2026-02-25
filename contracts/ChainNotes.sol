// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ChainNotes {
    struct Note {
        uint id;
        string content;
        string category;
        string[] tags;
        uint timestamp;
        address owner;
        bool isDeleted;
        bool isPublic;
        uint likeCount;
        uint totalTips;
    }

    struct NoteWithLikeStatus {
        Note note;
        bool hasLikedStatus;
    }

    uint public noteCount = 0;
    mapping(uint => Note) public notes;
    mapping(address => uint[]) public userNotes;
    mapping(uint => mapping(address => bool)) public hasLiked;
    uint[] public publicNoteIds;

    event NoteCreated(uint id, address owner, string content, uint timestamp, bool isPublic);
    event NoteUpdated(uint id, string newContent, uint timestamp, bool isPublic);
    event NoteDeleted(uint id);
    event NoteLiked(uint id, address liker, bool liked);
    event NoteTipped(uint id, address tipper, uint amount);

    modifier onlyOwner(uint _id) {
        require(notes[_id].owner == msg.sender, "Not the note owner");
        require(!notes[_id].isDeleted, "Note is deleted");
        _;
    }

    function createNote(string memory _content, string memory _category, string[] memory _tags, bool _isPublic) public {
        noteCount++;
        notes[noteCount] = Note(noteCount, _content, _category, _tags, block.timestamp, msg.sender, false, _isPublic, 0, 0);
        userNotes[msg.sender].push(noteCount);
        if (_isPublic) {
            publicNoteIds.push(noteCount);
        }
        emit NoteCreated(noteCount, msg.sender, _content, block.timestamp, _isPublic);
    }

    function getUserNotes() public view returns (Note[] memory) {
        uint[] memory userNoteIds = userNotes[msg.sender];
        
        uint count = 0;
        for(uint i = 0; i < userNoteIds.length; i++) {
            if (!notes[userNoteIds[i]].isDeleted) {
                count++;
            }
        }

        Note[] memory _notes = new Note[](count);
        uint index = 0;
        for(uint i = 0; i < userNoteIds.length; i++) {
            if (!notes[userNoteIds[i]].isDeleted) {
                _notes[index] = notes[userNoteIds[i]];
                index++;
            }
        }
        return _notes;
    }

    function updateNote(uint _id, string memory _content, string memory _category, string[] memory _tags, bool _isPublic) public onlyOwner(_id) {
        Note storage note = notes[_id];
        note.content = _content;
        note.category = _category;
        note.tags = _tags;
        note.timestamp = block.timestamp;
        note.isPublic = _isPublic;
        
        emit NoteUpdated(_id, _content, block.timestamp, _isPublic);
    }

    function deleteNote(uint _id) public onlyOwner(_id) {
        notes[_id].isDeleted = true;
        emit NoteDeleted(_id);
    }
}

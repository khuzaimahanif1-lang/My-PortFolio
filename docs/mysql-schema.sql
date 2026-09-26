-- Generated from the same SQLAlchemy models used by the API.
-- Apply to a new database; never use this file to overwrite an existing schema.


CREATE TABLE contact_messages (
	id VARCHAR(36) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	email VARCHAR(254) NOT NULL, 
	message TEXT NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
)

;


CREATE TABLE conversations (
	id VARCHAR(36) NOT NULL, 
	pair_key VARCHAR(75) NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (pair_key)
)

;


CREATE TABLE portfolio_content (
	`key` VARCHAR(80) NOT NULL, 
	data JSON NOT NULL, 
	PRIMARY KEY (`key`)
)

;


CREATE TABLE users (
	id VARCHAR(36) NOT NULL, 
	full_name VARCHAR(100) NOT NULL, 
	email VARCHAR(254) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	`role` VARCHAR(20) NOT NULL, 
	bio TEXT NOT NULL, 
	title VARCHAR(150) NOT NULL, 
	location VARCHAR(100) NOT NULL, 
	avatar_url VARCHAR(500) NOT NULL, 
	preferences JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
)

;

CREATE UNIQUE INDEX ix_users_email ON users (email);


CREATE TABLE activity_logs (
	id VARCHAR(36) NOT NULL, 
	owner_id VARCHAR(36) NOT NULL, 
	action VARCHAR(200) NOT NULL, 
	resource_type VARCHAR(30) NOT NULL, 
	resource_id VARCHAR(36) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE
)

;

CREATE INDEX ix_activity_logs_owner_id ON activity_logs (owner_id);

CREATE INDEX ix_activity_logs_created_at ON activity_logs (created_at);


CREATE TABLE attachments (
	id VARCHAR(36) NOT NULL, 
	owner_id VARCHAR(36) NOT NULL, 
	conversation_id VARCHAR(36), 
	filename VARCHAR(100) NOT NULL, 
	mime_type VARCHAR(80) NOT NULL, 
	size INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
)

;

CREATE INDEX ix_attachments_owner_id ON attachments (owner_id);


CREATE TABLE conversation_members (
	conversation_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	PRIMARY KEY (conversation_id, user_id), 
	FOREIGN KEY(conversation_id) REFERENCES conversations (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;


CREATE TABLE goals (
	id VARCHAR(36) NOT NULL, 
	owner_id VARCHAR(36) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT NOT NULL, 
	deadline VARCHAR(10) NOT NULL, 
	priority VARCHAR(20) NOT NULL, 
	progress INTEGER NOT NULL, 
	milestones JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE
)

;

CREATE INDEX ix_goals_owner_id ON goals (owner_id);


CREATE TABLE learning_entries (
	id VARCHAR(36) NOT NULL, 
	owner_id VARCHAR(36) NOT NULL, 
	topic VARCHAR(150) NOT NULL, 
	minutes INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE
)

;

CREATE INDEX ix_learning_entries_owner_id ON learning_entries (owner_id);


CREATE TABLE notes (
	id VARCHAR(36) NOT NULL, 
	owner_id VARCHAR(36) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	content TEXT NOT NULL, 
	category VARCHAR(80) NOT NULL, 
	tags JSON NOT NULL, 
	pinned BOOL NOT NULL, 
	favorite BOOL NOT NULL, 
	archived BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE
)

;

CREATE INDEX ix_notes_owner_id ON notes (owner_id);


CREATE TABLE notifications (
	id VARCHAR(36) NOT NULL, 
	owner_id VARCHAR(36) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	body VARCHAR(500) NOT NULL, 
	kind VARCHAR(30) NOT NULL, 
	link VARCHAR(300) NOT NULL, 
	is_read BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE
)

;

CREATE INDEX ix_notifications_owner_id ON notifications (owner_id);


CREATE TABLE password_reset_tokens (
	token_hash VARCHAR(64) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	expires_at DATETIME NOT NULL, 
	used BOOL NOT NULL, 
	PRIMARY KEY (token_hash), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;

CREATE INDEX ix_password_reset_tokens_user_id ON password_reset_tokens (user_id);


CREATE TABLE projects (
	id VARCHAR(36) NOT NULL, 
	owner_id VARCHAR(36) NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	slug VARCHAR(160) NOT NULL, 
	description TEXT NOT NULL, 
	short_description VARCHAR(300) NOT NULL, 
	category VARCHAR(80) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	progress INTEGER NOT NULL, 
	is_public BOOL NOT NULL, 
	is_portfolio BOOL NOT NULL DEFAULT '0', 
	technologies JSON NOT NULL, 
	tags JSON NOT NULL, 
	features JSON NOT NULL, 
	start_date VARCHAR(10) NOT NULL, 
	end_date VARCHAR(10) NOT NULL, 
	github_url VARCHAR(500) NOT NULL, 
	live_url VARCHAR(500) NOT NULL, 
	documentation TEXT NOT NULL, 
	architecture TEXT NOT NULL, 
	challenges TEXT NOT NULL, 
	solutions TEXT NOT NULL, 
	future_improvements TEXT NOT NULL, 
	screenshots JSON NOT NULL, 
	logo_url VARCHAR(500) NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (owner_id, slug), 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE
)

;

CREATE INDEX ix_projects_slug ON projects (slug);

CREATE INDEX ix_projects_owner_id ON projects (owner_id);

CREATE INDEX ix_projects_is_public ON projects (is_public);


CREATE TABLE sessions (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	created_at DATETIME NOT NULL, 
	last_seen DATETIME NOT NULL, 
	expires_at DATETIME NOT NULL, 
	unlock_until DATETIME NOT NULL, 
	locked BOOL NOT NULL, 
	revoked BOOL NOT NULL, 
	remember BOOL NOT NULL, 
	device VARCHAR(250) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;

CREATE INDEX ix_sessions_user_id ON sessions (user_id);


CREATE TABLE call_sessions (
	id VARCHAR(36) NOT NULL, 
	initiator_id VARCHAR(36) NOT NULL, 
	recipient_id VARCHAR(36), 
	initiator_session_id VARCHAR(36) NOT NULL, 
	recipient_session_id VARCHAR(36), 
	kind VARCHAR(20) NOT NULL, 
	state VARCHAR(20) NOT NULL, 
	code_hash VARCHAR(64), 
	control_allowed BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	expires_at DATETIME NOT NULL, 
	ended_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(initiator_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(recipient_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(initiator_session_id) REFERENCES sessions (id) ON DELETE CASCADE, 
	FOREIGN KEY(recipient_session_id) REFERENCES sessions (id) ON DELETE CASCADE, 
	UNIQUE (code_hash)
)

;

CREATE INDEX ix_call_sessions_recipient_id ON call_sessions (recipient_id);

CREATE INDEX ix_call_sessions_initiator_id ON call_sessions (initiator_id);


CREATE TABLE messages (
	id VARCHAR(36) NOT NULL, 
	conversation_id VARCHAR(36) NOT NULL, 
	sender_id VARCHAR(36) NOT NULL, 
	content TEXT NOT NULL, 
	attachment_id VARCHAR(36), 
	created_at DATETIME NOT NULL, 
	read_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(conversation_id) REFERENCES conversations (id) ON DELETE CASCADE, 
	FOREIGN KEY(sender_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(attachment_id) REFERENCES attachments (id) ON DELETE SET NULL
)

;

CREATE INDEX ix_messages_sender_id ON messages (sender_id);

CREATE INDEX ix_messages_created_at ON messages (created_at);

CREATE INDEX ix_messages_conversation_id ON messages (conversation_id);


CREATE TABLE refresh_tokens (
	token_hash VARCHAR(64) NOT NULL, 
	session_id VARCHAR(36) NOT NULL, 
	expires_at DATETIME NOT NULL, 
	used BOOL NOT NULL, 
	PRIMARY KEY (token_hash), 
	FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE CASCADE
)

;

CREATE INDEX ix_refresh_tokens_session_id ON refresh_tokens (session_id);


CREATE TABLE tasks (
	id VARCHAR(36) NOT NULL, 
	owner_id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36), 
	title VARCHAR(200) NOT NULL, 
	description TEXT NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	priority VARCHAR(20) NOT NULL, 
	due_date VARCHAR(10) NOT NULL, 
	progress INTEGER NOT NULL, 
	tags JSON NOT NULL, 
	subtasks JSON NOT NULL, 
	comments JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL
)

;

CREATE INDEX ix_tasks_owner_id ON tasks (owner_id);

CREATE INDEX ix_tasks_project_id ON tasks (project_id);

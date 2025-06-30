-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Allow anyone to create a user account (for signup)
CREATE POLICY "Anyone can create users" ON users
    FOR INSERT
    WITH CHECK (true);

-- Allow reading any user record (needed for username lookups during login)
CREATE POLICY "Anyone can read users" ON users
    FOR SELECT
    USING (true);

-- ============================================================================
-- NOTES TABLE POLICIES
-- ============================================================================

-- Policy for INSERT: Only allow creating notes if the user_id matches the current user
CREATE POLICY "Users can create own notes" ON notes
    FOR INSERT
    WITH CHECK (
        user_id IN (
            SELECT id FROM users WHERE username = current_setting('app.current_user', true)
        )
    );

-- Policy for SELECT: Users can only read their own notes
CREATE POLICY "Users can read own notes" ON notes
    FOR SELECT
    USING (
        user_id IN (
            SELECT id FROM users WHERE username = current_setting('app.current_user', true)
        )
    );

-- Policy for UPDATE: Users can only update their own notes
CREATE POLICY "Users can update own notes" ON notes
    FOR UPDATE
    USING (
        user_id IN (
            SELECT id FROM users WHERE username = current_setting('app.current_user', true)
        )
    )
    WITH CHECK (
        user_id IN (
            SELECT id FROM users WHERE username = current_setting('app.current_user', true)
        )
    );

-- Policy for DELETE: Users can only delete their own notes
CREATE POLICY "Users can delete own notes" ON notes
    FOR DELETE
    USING (
        user_id IN (
            SELECT id FROM users WHERE username = current_setting('app.current_user', true)
        )
    );

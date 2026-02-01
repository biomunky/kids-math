import streamlit as st
import sqlite3
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime

# Database connection
DB_PATH = "/Users/biomunky/scratch/ai/cc/math-hunter/backend/math_hunter.db"

@st.cache_data(ttl=60)
def load_data():
    """Load data from SQLite database"""
    conn = sqlite3.connect(DB_PATH)

    # Load sessions with timestamps
    sessions_df = pd.read_sql_query("""
        SELECT
            id as session_id,
            username,
            created_at
        FROM quiz_sessions
        ORDER BY created_at
    """, conn)

    # Load questions
    questions_df = pd.read_sql_query("""
        SELECT
            q.id,
            q.session_id,
            q.question_id,
            q.question_text,
            q.correct_answer,
            qs.username,
            qs.created_at
        FROM questions q
        JOIN quiz_sessions qs ON q.session_id = qs.id
    """, conn)

    # Load answers with correctness
    answers_df = pd.read_sql_query("""
        SELECT
            a.id,
            a.session_id,
            a.question_id,
            a.user_answer,
            a.is_correct,
            a.answered_at,
            qs.username
        FROM answers a
        JOIN quiz_sessions qs ON a.session_id = qs.id
        ORDER BY a.answered_at
    """, conn)

    conn.close()

    # Convert timestamps to datetime
    if not sessions_df.empty:
        sessions_df['created_at'] = pd.to_datetime(sessions_df['created_at'])
        sessions_df['date'] = sessions_df['created_at'].dt.date

    if not questions_df.empty:
        questions_df['created_at'] = pd.to_datetime(questions_df['created_at'])
        questions_df['date'] = questions_df['created_at'].dt.date

    if not answers_df.empty:
        answers_df['answered_at'] = pd.to_datetime(answers_df['answered_at'])
        answers_df['date'] = answers_df['answered_at'].dt.date

    return sessions_df, questions_df, answers_df

# Page configuration
st.set_page_config(
    page_title="K-POP DEMON HUNTER Dashboard",
    page_icon="🎯",
    layout="wide"
)

# Title
st.title("🎯 K-POP DEMON HUNTER Analytics Dashboard")
st.markdown("---")

# Load data
try:
    sessions_df, questions_df, answers_df = load_data()

    # Overall Metrics
    st.header("📊 Overall Statistics")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        num_users = sessions_df['username'].nunique() if not sessions_df.empty else 0
        st.metric("Total Users", num_users)

    with col2:
        num_sessions = len(sessions_df) if not sessions_df.empty else 0
        st.metric("Total Sessions", num_sessions)

    with col3:
        num_questions = len(questions_df) if not questions_df.empty else 0
        st.metric("Questions Asked", num_questions)

    with col4:
        num_correct = answers_df['is_correct'].sum() if not answers_df.empty else 0
        st.metric("Correctly Solved", int(num_correct))

    st.markdown("---")

    # Time-based analysis
    if not sessions_df.empty and not answers_df.empty:
        st.header("📈 Performance Over Time")

        # Sessions over time
        sessions_over_time = sessions_df.groupby('date').size().reset_index(name='sessions')
        sessions_over_time['date'] = pd.to_datetime(sessions_over_time['date'])

        fig_sessions = px.line(
            sessions_over_time,
            x='date',
            y='sessions',
            title='Sessions Over Time',
            markers=True
        )
        fig_sessions.update_layout(xaxis_title="Date", yaxis_title="Number of Sessions")
        st.plotly_chart(fig_sessions, use_container_width=True)

        # Questions and correct answers over time
        questions_over_time = questions_df.groupby('date').size().reset_index(name='questions')
        questions_over_time['date'] = pd.to_datetime(questions_over_time['date'])

        correct_over_time = answers_df[answers_df['is_correct'] == 1].groupby('date').size().reset_index(name='correct')
        correct_over_time['date'] = pd.to_datetime(correct_over_time['date'])

        # Merge for comparison
        time_comparison = pd.merge(questions_over_time, correct_over_time, on='date', how='left')
        time_comparison['correct'] = time_comparison['correct'].fillna(0)
        time_comparison['accuracy'] = (time_comparison['correct'] / time_comparison['questions'] * 100).round(1)

        col1, col2 = st.columns(2)

        with col1:
            fig_questions = go.Figure()
            fig_questions.add_trace(go.Scatter(
                x=time_comparison['date'],
                y=time_comparison['questions'],
                name='Questions Asked',
                mode='lines+markers',
                line=dict(color='blue')
            ))
            fig_questions.add_trace(go.Scatter(
                x=time_comparison['date'],
                y=time_comparison['correct'],
                name='Correct Answers',
                mode='lines+markers',
                line=dict(color='green')
            ))
            fig_questions.update_layout(
                title='Questions vs Correct Answers Over Time',
                xaxis_title='Date',
                yaxis_title='Count'
            )
            st.plotly_chart(fig_questions, use_container_width=True)

        with col2:
            fig_accuracy = px.line(
                time_comparison,
                x='date',
                y='accuracy',
                title='Accuracy Rate Over Time (%)',
                markers=True
            )
            fig_accuracy.update_layout(xaxis_title="Date", yaxis_title="Accuracy (%)")
            st.plotly_chart(fig_accuracy, use_container_width=True)

        st.markdown("---")

        # User Performance Analysis
        st.header("👥 User Performance")

        # Calculate per-user statistics
        user_stats = []
        for username in sessions_df['username'].unique():
            user_sessions = sessions_df[sessions_df['username'] == username]
            user_answers = answers_df[answers_df['username'] == username]

            num_sessions = len(user_sessions)
            num_questions = len(questions_df[questions_df['username'] == username])
            num_answered = len(user_answers)
            num_correct = user_answers['is_correct'].sum()
            accuracy = (num_correct / num_answered * 100) if num_answered > 0 else 0

            user_stats.append({
                'Username': username,
                'Sessions': num_sessions,
                'Questions Asked': num_questions,
                'Questions Answered': num_answered,
                'Correct Answers': int(num_correct),
                'Accuracy (%)': round(accuracy, 1)
            })

        user_stats_df = pd.DataFrame(user_stats)
        user_stats_df = user_stats_df.sort_values('Sessions', ascending=False)

        # Display user stats table
        st.dataframe(user_stats_df, use_container_width=True, hide_index=True)

        # User comparison charts
        col1, col2 = st.columns(2)

        with col1:
            fig_user_sessions = px.bar(
                user_stats_df,
                x='Username',
                y='Sessions',
                title='Sessions per User',
                color='Sessions',
                color_continuous_scale='Blues'
            )
            st.plotly_chart(fig_user_sessions, use_container_width=True)

        with col2:
            fig_user_accuracy = px.bar(
                user_stats_df,
                x='Username',
                y='Accuracy (%)',
                title='Accuracy per User',
                color='Accuracy (%)',
                color_continuous_scale='Greens'
            )
            st.plotly_chart(fig_user_accuracy, use_container_width=True)

        st.markdown("---")

        # Individual User Deep Dive
        st.header("🔍 Individual User Analysis")

        selected_user = st.selectbox("Select a user to view detailed performance", sessions_df['username'].unique())

        if selected_user:
            user_sessions = sessions_df[sessions_df['username'] == selected_user]
            user_answers = answers_df[answers_df['username'] == selected_user]

            # User metrics
            col1, col2, col3 = st.columns(3)

            with col1:
                st.metric("Total Sessions", len(user_sessions))

            with col2:
                total_answered = len(user_answers)
                st.metric("Total Answered", total_answered)

            with col3:
                correct_answers = user_answers['is_correct'].sum()
                accuracy = (correct_answers / total_answered * 100) if total_answered > 0 else 0
                st.metric("Overall Accuracy", f"{accuracy:.1f}%")

            # Performance over time for selected user
            if not user_answers.empty:
                user_daily = user_answers.groupby('date').agg({
                    'is_correct': ['sum', 'count']
                }).reset_index()
                user_daily.columns = ['date', 'correct', 'total']
                user_daily['accuracy'] = (user_daily['correct'] / user_daily['total'] * 100).round(1)
                user_daily['date'] = pd.to_datetime(user_daily['date'])

                fig_user_trend = go.Figure()
                fig_user_trend.add_trace(go.Scatter(
                    x=user_daily['date'],
                    y=user_daily['total'],
                    name='Questions Answered',
                    mode='lines+markers',
                    line=dict(color='blue')
                ))
                fig_user_trend.add_trace(go.Scatter(
                    x=user_daily['date'],
                    y=user_daily['correct'],
                    name='Correct Answers',
                    mode='lines+markers',
                    line=dict(color='green')
                ))
                fig_user_trend.update_layout(
                    title=f"{selected_user}'s Performance Over Time",
                    xaxis_title='Date',
                    yaxis_title='Count'
                )
                st.plotly_chart(fig_user_trend, use_container_width=True)

                # Session-by-session breakdown
                st.subheader(f"Session History for {selected_user}")
                session_details = []
                for _, session in user_sessions.iterrows():
                    session_answers = user_answers[user_answers['session_id'] == session['session_id']]
                    num_answered = len(session_answers)
                    num_correct = session_answers['is_correct'].sum()
                    session_details.append({
                        'Date': session['created_at'].strftime('%Y-%m-%d %H:%M:%S'),
                        'Session ID': session['session_id'][:8] + '...',
                        'Questions Answered': num_answered,
                        'Correct': int(num_correct),
                        'Score': f"{num_correct}/{num_answered}"
                    })

                session_details_df = pd.DataFrame(session_details)
                st.dataframe(session_details_df, use_container_width=True, hide_index=True)

    else:
        st.info("No data available yet. Start playing the K-POP DEMON HUNTER quiz to see analytics!")

except Exception as e:
    st.error(f"Error loading data: {str(e)}")
    st.info(f"Make sure the database exists at: {DB_PATH}")

# Refresh button
st.markdown("---")
if st.button("🔄 Refresh Data"):
    st.cache_data.clear()
    st.rerun()

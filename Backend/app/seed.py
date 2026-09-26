"""Create a local owner, labeled starter project concepts, and portfolio content."""
import secrets
from sqlalchemy import select
from .core.database import Base,engine,SessionLocal
from .core.migrations import migrate_portfolio
from .core.config import ROOT
from .models import User,Project,Task,Note,Goal,PortfolioContent
from .services.security import hash_password

def seed():
    Base.metadata.create_all(engine)
    migrate_portfolio(engine)
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.role=="OWNER")):
            print("Owner workspace already exists; existing data preserved.")
            return
        password=secrets.token_urlsafe(18)
        user=User(full_name="Khuzaima Hanif",email="owner@example.com",password_hash=hash_password(password),
            role="OWNER",title="AI Engineer · Full-Stack Developer",bio="Building at the intersection of AI, thoughtful design, and the web.")
        db.add(user)
        db.flush()
        concepts=[
            ("AI Interview Platform","A concept for more thoughtful interview practice, powered by conversational AI.","AI / ML",["Angular","Python","FastAPI","WebSocket"]),
            ("Jarvis AI Assistant","A personal assistant concept for connecting everyday tools and useful intelligence.","AI / ML",["Python","FastAPI"]),
            ("AI Demo Request System","A full-stack concept for requesting, organizing, and tracking product demonstrations.","Full-stack",["Angular","FastAPI","MySQL"]),
            ("Computer Vision Lab","A learning project space for image understanding and visual experimentation.","Research",["Python","Machine Learning"])]
        for name,description,category,technologies in concepts:
            project=Project(owner_id=user.id,name=name,slug=name.lower().replace(" ","-"),
                description=description+"\n\nStarter concept from the project brief. No deployed product or verified completion is claimed.",
                short_description=description,category=category,technologies=technologies,is_public=True,is_portfolio=True,
                tags=["Starter concept"],status="PLANNED",progress=0,
                documentation="# Project direction\n\nThis is a starter concept. Add specifications, decisions, setup instructions and implementation notes here.",
                features=["Define requirements","Build the core experience","Test and document"])
            db.add(project)
        db.add(Note(owner_id=user.id,title="Welcome to the command center",category="Future Plans",pinned=True,
            content="# Build. Learn. Grow.\n\nThese starter concepts come from the project brief. Replace them with your actual work, progress, and documentation.\n\n- Plan your first milestone\n- Add a project task\n- Record a learning session\n- Make something useful",tags=["Starter content"]))
        db.add(Goal(owner_id=user.id,title="Turn the first concept into a working project",description="A starter goal. Set your own milestones and deadline.",
            milestones=[{"title":"Define the scope","done":False},{"title":"Ship the first working version","done":False}]))
        db.add(PortfolioContent(key="profile",data={
            "name":"Khuzaima Hanif","title":"AI Engineer · Full-Stack Developer · AI Enthusiast",
            "bio":"I explore artificial intelligence and build thoughtful web experiences. My focus is simple: keep learning, solve real problems, and turn ambitious ideas into useful tools.",
            "location":"","email":"","github_url":"","linkedin_url":"",
            "skills":["Angular","TypeScript","Python","FastAPI","MySQL","Machine Learning","Three.js","WebSocket"],
            "journey":[{"label":"The foundation","title":"Learning by building","description":"Developing the fundamentals of modern web applications and Python."},
                {"label":"The intersection","title":"Connecting AI and the web","description":"Exploring how intelligent systems can make software more useful."},
                {"label":"What's next","title":"An ambitious future","description":"Growing toward practical AI engineering through projects, experimentation, and continuous learning."}],
            "achievements":[],"vision":"Build intelligent tools that make a meaningful difference. Stay curious. Keep creating."}))
        db.commit()
        ROOT.joinpath("storage","owner-credentials.txt").write_text(
            f"LOCAL DEVELOPMENT OWNER\nEmail: {user.email}\nPassword: {password}\n\nChange this password in Account → Security. This file is ignored by Git.\n",encoding="utf-8")
        print("Created local owner and starter concepts. Credentials: Backend/storage/owner-credentials.txt")
if __name__=="__main__":
    seed()



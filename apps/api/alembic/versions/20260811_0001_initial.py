"""Initial Phase 1 schema.

Revision ID: 20260811_0001
Revises:
Create Date: 2026-08-11
"""

from alembic import op

from apps.api.app.db.models import Base

revision = "20260811_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind(), checkfirst=True)

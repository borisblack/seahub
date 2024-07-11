# Generated by Django 4.2.2 on 2024-06-12 10:18

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0004_orgsamlconfig_orgadminsettings'),
    ]

    operations = [
        migrations.AddField(
            model_name='orgsamlconfig',
            name='dns_txt',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='orgsamlconfig',
            name='domain_verified',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='orgsamlconfig',
            name='idp_certificate',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='orgsamlconfig',
            name='domain',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
    ]
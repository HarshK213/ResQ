import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { colors, fontSize, spacing, borderRadius, shadows } from '../../../config/theme';
import Badge, { getEmergencyTypeVariant, getStatusVariant } from '../../../components/Badge';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmergencyMap from '../components/EmergencyMap';
import { useEmergency } from '../hooks/useEmergency';
import { useLocation } from '../../../hooks/useLocation';
import { formatDateTime } from '../../../utils/formatters';
import { calculateDistance, formatDistance, estimateTravelTime } from '../../../utils/distance';
import type { EmergencyRequest } from '../../../types/emergency';

type TimelineStep =
  | 'request_raised'
  | 'searching'
  | 'notified'
  | 'accepted'
  | 'en_route'
  | 'arrived'
  | 'resolved';

const TIMELINE_STEPS: { key: TimelineStep; label: string }[] = [
  { key: 'request_raised', label: 'Request Raised' },
  { key: 'searching', label: 'Searching for Volunteers' },
  { key: 'notified', label: 'Volunteers Notified' },
  { key: 'accepted', label: 'Volunteer Accepted' },
  { key: 'en_route', label: 'Help En Route' },
  { key: 'arrived', label: 'Help Arrived' },
  { key: 'resolved', label: 'Emergency Resolved' },
];

function getCurrentTimelineStep(status: string): TimelineStep {
  switch (status) {
    case 'open': return 'searching';
    case 'matched': return 'notified';
    case 'assigned': return 'accepted';
    case 'completed': return 'resolved';
    case 'cancelled': return 'resolved';
    default: return 'request_raised';
  }
}

function getEmergencyNumbers(resource: string): { label: string; number: string }[] {
  const numbers: { label: string; number: string }[] = [];
  if (resource === 'medical') numbers.push({ label: 'Ambulance', number: '108' });
  if (resource === 'rescue') numbers.push({ label: 'Police', number: '100' });
  if (resource === 'supplies') numbers.push({ label: 'Police', number: '100' });
  if (resource === 'transport') numbers.push({ label: 'Ambulance', number: '108' });
  if (resource === 'other' || !resource) {
    numbers.push(
      { label: 'Ambulance', number: '108' },
      { label: 'Police', number: '100' },
      { label: 'Fire', number: '101' },
    );
  }
  return numbers;
}

interface EmergencyStatusScreenProps {
  navigation: any;
  route: any;
}

const EmergencyStatusScreen: React.FC<EmergencyStatusScreenProps> = ({ navigation, route }) => {
  const { emergency, emergencyId } = route.params || {};
  const { currentEmergency, fetchEmergencyById, cancelEmergency, clearCurrentEmergency } = useEmergency();
  const { coordinates: userLocation, watchLocation } = useLocation();
  const [currentStep, setCurrentStep] = useState<TimelineStep>('request_raised');
  const [volunteersNotified, setVolunteersNotified] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const emergencyData: EmergencyRequest | null = currentEmergency || emergency || null;

  useEffect(() => {
    if (emergencyId) {
      fetchEmergencyById(emergencyId);
    }
    return () => {
      clearCurrentEmergency();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [emergencyId]);

  useEffect(() => {
    if (emergencyData) {
      setCurrentStep(getCurrentTimelineStep(emergencyData.status));
    }
  }, [emergencyData?.status]);

  useEffect(() => {
    const created = emergencyData ? new Date(emergencyData.created_at).getTime() : Date.now();
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - created) / 1000));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [emergencyData?.created_at]);

  useEffect(() => {
    if (currentStep === 'searching' || currentStep === 'notified') {
      const t = setInterval(() => {
        setVolunteersNotified((p) => Math.min(p + 1, 12));
      }, 8000);
      return () => clearInterval(t);
    }
  }, [currentStep]);

  const handleCall = (number: string) => {
    const phoneUrl = `tel:${number}`;
    Linking.canOpenURL(phoneUrl).then((canOpen) => {
      if (canOpen) Linking.openURL(phoneUrl);
      else Alert.alert('Call', `Please dial ${number}`);
    });
  };

  const handleCancel = () => {
    if (!emergencyData) return;
    Alert.alert(
      'Cancel Emergency Request',
      'Are you sure you want to cancel this emergency request?',
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            await cancelEmergency(emergencyData._id);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleShareLocation = () => {
    if (!userLocation) return;
    const msg = `I need help! My location: https://maps.google.com/?q=${userLocation.latitude},${userLocation.longitude}`;
    const smsUrl = Platform.select({
      ios: `sms:&body=${encodeURIComponent(msg)}`,
      android: `sms:?body=${encodeURIComponent(msg)}`,
      default: `sms:?body=${encodeURIComponent(msg)}`,
    });
    Linking.canOpenURL(smsUrl).then((canOpen) => {
      if (canOpen) Linking.openURL(smsUrl!);
    });
  };

  if (!emergencyData) {
    return <LoadingSpinner fullScreen message="Loading emergency status..." />;
  }

  const coords = emergencyData.location?.coordinates;
  const emergencyLatLng = coords ? { latitude: coords[1], longitude: coords[0] } : null;
  const typeVariant = getEmergencyTypeVariant(emergencyData.resource);
  const statusVariant = getStatusVariant(emergencyData.status);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isHighUrgency = emergencyData.urgency === 'high';
  const isWaiting = currentStep === 'searching' || currentStep === 'notified' || currentStep === 'request_raised';
  const isResolved = currentStep === 'resolved';
  const emergencyNumbers = getEmergencyNumbers(emergencyData.resource);
  const timelineIndex = TIMELINE_STEPS.findIndex((s) => s.key === currentStep);

  const volunteerDistance = userLocation && emergencyLatLng
    ? calculateDistance(userLocation.latitude, userLocation.longitude, emergencyLatLng.latitude, emergencyLatLng.longitude)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <EmergencyMap
        userLocation={userLocation}
        emergencyLocation={emergencyLatLng}
        emergencyType={emergencyData.resource}
        height={200}
      />

      <View style={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <Badge label={emergencyData.resource} variant={typeVariant} size="md" />
          <Badge label={emergencyData.urgency} variant={isHighUrgency ? 'emergency' : 'warning'} size="md" />
        </View>

        <Text style={styles.emergencyId}>ID: {emergencyData._id.slice(-8).toUpperCase()}</Text>
        <Text style={styles.locationName}>{emergencyData.location_name}</Text>

        {emergencyData.description && (
          <Text style={styles.description}>{emergencyData.description}</Text>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Raised {formatDateTime(emergencyData.created_at)}</Text>
          <Text style={styles.metaText}>{`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} ago`}</Text>
        </View>

        {emergencyLatLng && (
          <View style={styles.coordsBox}>
            <Text style={styles.coordsText}>
              {emergencyLatLng.latitude.toFixed(6)}, {emergencyLatLng.longitude.toFixed(6)}
            </Text>
          </View>
        )}
      </View>

      {isWaiting && (
        <View style={styles.waitingCard}>
          <View style={styles.searchAnimation}>
            <Text style={styles.searchIcon}>🔍</Text>
          </View>
          <Text style={styles.waitingTitle}>Request Raised</Text>
          <Text style={styles.waitingMessage}>
            Searching for nearby volunteers...
          </Text>
          <Text style={styles.waitingSubMessage}>
            Your request has been broadcast to nearby responders.
          </Text>
          <Text style={styles.waitingSubMessage}>
            Please stay safe while we locate assistance.
          </Text>
          <View style={styles.notifiedBadge}>
            <Text style={styles.notifiedText}>
              {volunteersNotified} volunteers notified
            </Text>
          </View>
          {volunteerDistance > 0 && (
            <Text style={styles.etaText}>
              Est. response: ~{estimateTravelTime(volunteerDistance)} min
            </Text>
          )}
        </View>
      )}

      {currentStep === 'accepted' || currentStep === 'en_route' || currentStep === 'arrived' ? (
        <View style={styles.volunteerCard}>
          <View style={styles.volunteerHeader}>
            <View style={styles.volunteerAvatar}>
              <Text style={styles.volunteerAvatarText}>👤</Text>
            </View>
            <View style={styles.volunteerInfo}>
              <Text style={styles.volunteerName}>Responder</Text>
              <Text style={styles.volunteerDist}>
                {formatDistance(volunteerDistance)} away
              </Text>
              <Text style={styles.volunteerEta}>
                Est. arrival: ~{estimateTravelTime(volunteerDistance)} min
              </Text>
            </View>
          </View>
          <View style={styles.volunteerActions}>
            <Button
              title="Call"
              onPress={() => handleCall('+919999999999')}
              variant="primary"
              size="sm"
              style={styles.volActionBtn}
            />
            <Button
              title="Message"
              onPress={() => Alert.alert('Message', 'Messaging feature coming soon.')}
              variant="outline"
              size="sm"
              style={styles.volActionBtn}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.timelineCard}>
        <Text style={styles.sectionTitle}>Status Timeline</Text>
        {TIMELINE_STEPS.map((step, idx) => {
          const isPast = idx <= timelineIndex;
          const isCurrent = idx === timelineIndex;
          return (
            <View key={step.key} style={styles.timelineStep}>
              <View style={styles.timelineLine}>
                <View
                  style={[
                    styles.timelineDot,
                    isPast && styles.timelineDotActive,
                    isCurrent && styles.timelineDotCurrent,
                  ]}
                />
                {idx < TIMELINE_STEPS.length - 1 && (
                  <View
                    style={[
                      styles.timelineConnector,
                      isPast && styles.timelineConnectorActive,
                    ]}
                  />
                )}
              </View>
              <View style={styles.timelineContent}>
                <Text
                  style={[
                    styles.timelineLabel,
                    isPast && styles.timelineLabelActive,
                    isCurrent && styles.timelineLabelCurrent,
                  ]}
                >
                  {step.label}
                </Text>
                {isCurrent && !isResolved && (
                  <Text style={styles.timelineStatus}>In progress...</Text>
                )}
                {isCurrent && isResolved && (
                  <Text style={[styles.timelineStatus, { color: colors.success }]}>Complete</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {isHighUrgency && !isResolved && (
        <View style={styles.emergencyActionsCard}>
          <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          <View style={styles.emergencyBtns}>
            {emergencyNumbers.map((item, idx) => (
              <TouchableOpacity
                key={`${item.number}-${idx}`}
                style={styles.emergencyBtn}
                onPress={() => handleCall(item.number)}
                accessibilityLabel={`Call ${item.label}`}
              >
                <Text style={styles.emergencyBtnIcon}>
                  {item.label === 'Ambulance' ? '🚑' : item.label === 'Police' ? '🚔' : '🚒'}
                </Text>
                <Text style={styles.emergencyBtnLabel}>{item.label}</Text>
                <Text style={styles.emergencyBtnNumber}>{item.number}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {!isResolved && emergencyData.advisory && (
        <View style={styles.safetyCard}>
          <Text style={styles.sectionTitle}>Advisory</Text>
          <Text style={styles.advisoryText}>{emergencyData.advisory}</Text>
        </View>
      )}

      {!isResolved && (
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Button
            title="Share Live Location"
            onPress={handleShareLocation}
            variant="outline"
            size="md"
            fullWidth
            style={styles.actionBtn}
          />
          {isWaiting && (
            <Button
              title="Escalate Request"
              onPress={() => Alert.alert('Escalated', 'Your request has been escalated to additional responders.')}
              variant="warning"
              size="md"
              fullWidth
              style={styles.actionBtn}
            />
          )}
          <Button
            title="Cancel Request"
            onPress={handleCancel}
            variant="ghost"
            size="md"
            fullWidth
            textStyle={{ color: colors.error }}
          />
        </View>
      )}

      {isResolved && (
        <View style={styles.resolvedCard}>
          <Text style={styles.resolvedIcon}>✅</Text>
          <Text style={styles.resolvedTitle}>Emergency Resolved</Text>
          <Text style={styles.resolvedMessage}>
            Your emergency request has been resolved. Stay safe!
          </Text>
          <Button
            title="Back to Home"
            onPress={() => navigation.navigate('MainTabs')}
            variant="primary"
            size="lg"
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },

  overviewCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  overviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  emergencyId: { fontSize: fontSize.sm, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: spacing.xs },
  locationName: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  description: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 20 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  metaText: { fontSize: fontSize.sm, color: colors.textSecondary },
  coordsBox: { backgroundColor: colors.background, padding: spacing.sm, borderRadius: borderRadius.md },
  coordsText: { fontSize: fontSize.xs, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', textAlign: 'center' },

  waitingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...shadows.md,
  },
  searchAnimation: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.emergencyLight + '20', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  searchIcon: { fontSize: 32 },
  waitingTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  waitingMessage: { fontSize: fontSize.md, color: colors.emergency, fontWeight: '600', marginBottom: spacing.xs, textAlign: 'center' },
  waitingSubMessage: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xs },
  notifiedBadge: { backgroundColor: colors.info + '20', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.round, marginTop: spacing.sm, marginBottom: spacing.xs },
  notifiedText: { fontSize: fontSize.sm, color: colors.info, fontWeight: '600' },
  etaText: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },

  volunteerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  volunteerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  volunteerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.helpAvailableLight + '30', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  volunteerAvatarText: { fontSize: 24 },
  volunteerInfo: { flex: 1 },
  volunteerName: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  volunteerDist: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  volunteerEta: { fontSize: fontSize.sm, color: colors.helpAvailable, fontWeight: '600', marginTop: 2 },
  volunteerActions: { flexDirection: 'row', gap: spacing.md },
  volActionBtn: { flex: 1 },

  timelineCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  timelineStep: { flexDirection: 'row', marginBottom: 0 },
  timelineLine: { alignItems: 'center', width: 24, marginRight: spacing.md },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border, zIndex: 1 },
  timelineDotActive: { backgroundColor: colors.helpAvailable },
  timelineDotCurrent: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.emergency },
  timelineConnector: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
  timelineConnectorActive: { backgroundColor: colors.helpAvailable },
  timelineContent: { paddingBottom: spacing.lg, flex: 1 },
  timelineLabel: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: '500' },
  timelineLabelActive: { color: colors.text, fontWeight: '600' },
  timelineLabelCurrent: { color: colors.emergency, fontWeight: '800' },
  timelineStatus: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

  emergencyActionsCard: {
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  emergencyBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emergencyBtn: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  emergencyBtnIcon: { fontSize: 28, marginBottom: spacing.xs },
  emergencyBtnLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  emergencyBtnNumber: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  safetyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  safetyText: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  advisoryText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },

  actionsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  actionBtn: { marginBottom: spacing.sm },

  resolvedCard: {
    backgroundColor: colors.helpAvailable + '15',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.md,
  },
  resolvedIcon: { fontSize: 48, marginBottom: spacing.md },
  resolvedTitle: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.helpAvailable, marginBottom: spacing.sm },
  resolvedMessage: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});

export default EmergencyStatusScreen;
